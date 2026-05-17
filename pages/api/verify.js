import { createClient } from '@supabase/supabase-js'
import Groq from 'groq-sdk'
import formidable from 'formidable'
import fs from 'fs'
import crypto from 'crypto'
import sharp from 'sharp'

export const config = { api: { bodyParser: false } }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ── Perceptual Hash ──────────────────────────────────────────────
async function computePhash(buf) {
  const { data } = await sharp(buf).resize(32,32,{fit:'fill'}).grayscale().raw().toBuffer({resolveWithObject:true})
  const pixels = Array.from(data)
  const mean = pixels.reduce((s,p)=>s+p,0)/pixels.length
  const bits = pixels.map(p=>p>=mean?'1':'0')
  let hex=''
  for(let i=0;i<bits.length;i+=4) hex+=parseInt(bits.slice(i,i+4).join(''),2).toString(16)
  return hex
}

function hammingDistance(h1,h2) {
  if(h1.length!==h2.length) return Infinity
  let d=0
  for(let i=0;i<h1.length;i++){
    const b1=parseInt(h1[i],16).toString(2).padStart(4,'0')
    const b2=parseInt(h2[i],16).toString(2).padStart(4,'0')
    for(let j=0;j<4;j++) if(b1[j]!==b2[j]) d++
  }
  return d
}

function similarity(h1,h2) {
  const total=h1.length*4
  return ((total-hammingDistance(h1,h2))/total)*100
}

// ── Helpers ───────────────────────────────────────────────────────
function normalizeAmount(amount) {
  if(!amount||amount==='UNKNOWN') return null
  const n=parseFloat(amount.replace(/[^0-9.]/g,''))
  return isNaN(n)?null:Math.abs(n).toFixed(2)
}

function isScreenshotTooOld(dt,maxHours) {
  if(!dt||dt==='UNKNOWN') return false
  try {
    const d=new Date(dt)
    if(isNaN(d.getTime())) return false
    return (new Date()-d)/(1000*60*60)>maxHours
  } catch { return false }
}

// ── AI Prompt ─────────────────────────────────────────────────────
function buildPrompt(method) {
  const instructions = {
    CashApp:`CashApp screenshot. Large name at top = sender. Amount may be negative (e.g. -$10). Transaction ID usually UNKNOWN. "Complete" confirms success.`,
    Chime:`Chime screenshot. Large name at top = sender. Amount may be negative. Transaction ID usually UNKNOWN. "Complete" confirms success.`,
    Zelle:`Zelle screenshot. Look for "From:" or "Sent by". Confirmation number = transaction ID. "You received" confirms direction.`,
    TapTap:`TapTap Send screenshot. Look for reference/transaction number. Status should say "Completed" or "Success".`,
    Venmo:`Venmo screenshot. Look for sender username or name. Payment note/memo visible below amount.`,
    PayPal:`PayPal screenshot. Transaction ID shown. Look for sender email or name. "Payment received" confirms direction.`,
    Other:`Generic payment screenshot. Extract any transaction/reference ID, amount, and sender.`,
  }
  return `You are a payment screenshot analyzer. Extract details from this screenshot.
Return ONLY valid JSON, no markdown, no explanation.

${instructions[method]||instructions.Other}

Return exactly:
{
  "transaction_id": "exact ID shown or UNKNOWN",
  "amount": "amount with currency e.g. $10.00 or UNKNOWN",
  "sender_name": "name of person who SENT money or UNKNOWN",
  "memo": "note/memo on payment or UNKNOWN",
  "date_time": "date and time or UNKNOWN",
  "payment_app": "${method}"
}

Rules: sender_name = who SENT money. Return ONLY the JSON.`
}

// ── Per-method check config ───────────────────────────────────────
function getChecks(method) {
  return {
    CashApp:  { txnId:false, amtSender:true,  amtDate:false, maxAge:48, dupThresh:98, cropThresh:92 },
    Chime:    { txnId:false, amtSender:true,  amtDate:false, maxAge:48, dupThresh:98, cropThresh:92 },
    Zelle:    { txnId:true,  amtSender:true,  amtDate:true,  maxAge:48, dupThresh:97, cropThresh:85 },
    TapTap:   { txnId:true,  amtSender:true,  amtDate:true,  maxAge:48, dupThresh:97, cropThresh:85 },
    Venmo:    { txnId:true,  amtSender:true,  amtDate:false, maxAge:48, dupThresh:97, cropThresh:88 },
    PayPal:   { txnId:true,  amtSender:false, amtDate:false, maxAge:72, dupThresh:98, cropThresh:88 },
    Other:    { txnId:true,  amtSender:true,  amtDate:false, maxAge:72, dupThresh:99, cropThresh:88 },
  }[method] || { txnId:true, amtSender:true, amtDate:false, maxAge:72, dupThresh:99, cropThresh:88 }
}

// ── Notify finance team ───────────────────────────────────────────
async function notifyFinance(paymentMethod, uploaderEmail, paymentId) {
  const { data: finance } = await supabase.from('profiles').select('email')
    .eq('role','finance')
    .or(`payment_methods.cs.{${paymentMethod}},payment_methods.eq.{}`)

  const { data: allFinance } = await supabase.from('profiles').select('email').eq('role','finance')
  const targets = (finance?.length > 0 ? finance : allFinance) || []

  if (targets.length > 0) {
    await supabase.from('notifications').insert(
      targets.map(f => ({
        recipient_email: f.email,
        type: 'payment_submitted',
        title: `New ${paymentMethod} Payment to Review`,
        message: `${uploaderEmail} submitted a ${paymentMethod} payment screenshot for review.`,
        related_id: paymentId,
      }))
    )
  }
}

// ── MAIN HANDLER ─────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' })

  try {
    const form = formidable({ multiples:false, maxFileSize:10*1024*1024 })
    const [fields, files] = await new Promise((ok,err) =>
      form.parse(req,(e,f,fi)=>e?err(e):ok([f,fi]))
    )

    const file = Array.isArray(files.file)?files.file[0]:files.file
    const paymentMethod = Array.isArray(fields.paymentMethod)?fields.paymentMethod[0]:fields.paymentMethod
    const uploaderName  = Array.isArray(fields.uploaderName)?fields.uploaderName[0]:fields.uploaderName

    const buf       = fs.readFileSync(file.filepath)
    const b64       = buf.toString('base64')
    const mime      = file.mimetype||'image/jpeg'
    const imageHash = crypto.createHash('md5').update(buf).digest('hex')
    const phash     = await computePhash(buf)
    const checks    = getChecks(paymentMethod)

    // STEP 1 — Exact duplicate
    const { data: existing } = await supabase.from('payments').select('*').eq('image_hash',imageHash).maybeSingle()
    if (existing) return res.json({ status:'duplicate', details:existing, original:existing, reason:'exact_image', message:'❌ Exact same screenshot already uploaded!' })

    // STEP 2 — AI extraction
    const completion = await groq.chat.completions.create({
      model:'meta-llama/llama-4-scout-17b-16e-instruct',
      temperature:0.1, max_tokens:600,
      messages:[{ role:'user', content:[
        { type:'text', text:buildPrompt(paymentMethod) },
        { type:'image_url', image_url:{ url:`data:${mime};base64,${b64}` } }
      ]}]
    })

    let extracted = {}
    try {
      const raw = completion.choices[0]?.message?.content||''
      const clean = raw.replace(/```json/g,'').replace(/```/g,'').trim()
      extracted = JSON.parse(clean.match(/\{[\s\S]*\}/)[0])
    } catch {
      extracted = { transaction_id:'UNKNOWN', amount:'UNKNOWN', sender_name:'UNKNOWN', memo:'UNKNOWN', date_time:'UNKNOWN', payment_app:paymentMethod }
    }

    const normAmt = normalizeAmount(extracted.amount)

    // STEP 3 — Too old?
    if (isScreenshotTooOld(extracted.date_time, checks.maxAge)) {
      return res.json({ status:'suspicious', details:extracted, original:null, reason:'old_screenshot', message:`⚠️ This screenshot is older than ${checks.maxAge} hours - needs manual review` })
    }

    // STEP 4 — Duplicate by transaction ID
    if (checks.txnId && extracted.transaction_id && extracted.transaction_id!=='UNKNOWN' && extracted.transaction_id!=='N/A') {
      const { data:txnMatch } = await supabase.from('payments').select('*').eq('transaction_id',extracted.transaction_id).maybeSingle()
      if (txnMatch) return res.json({ status:'duplicate', details:extracted, original:txnMatch, reason:'duplicate_transaction_id', message:'❌ Same Transaction ID already exists!' })
    }

    // STEP 5 — Same amount + sender
    if (checks.amtSender && normAmt && extracted.sender_name && extracted.sender_name!=='UNKNOWN') {
      const { data:recs } = await supabase.from('payments').select('*').eq('sender_name',extracted.sender_name).eq('payment_method',paymentMethod)
      if (recs?.length > 0) {
        const match = recs.find(p=>normalizeAmount(p.amount)===normAmt)
        if (match) return res.json({ status:'suspicious', details:extracted, original:match, reason:'same_amount_sender', message:'⚠️ Same amount from same sender already found - needs manual review' })
      }
    }

    // STEP 6 — Same amount + same date
    if (checks.amtDate && normAmt && extracted.date_time && extracted.date_time!=='UNKNOWN') {
      try {
        const d = new Date(extracted.date_time)
        if (!isNaN(d.getTime())) {
          const dateStr = d.toISOString().split('T')[0]
          const { data:dayRecs } = await supabase.from('payments').select('*').eq('payment_method',paymentMethod).gte('created_at',`${dateStr}T00:00:00`).lte('created_at',`${dateStr}T23:59:59`)
          if (dayRecs?.length > 0) {
            const match = dayRecs.find(p=>normalizeAmount(p.amount)===normAmt)
            if (match) return res.json({ status:'suspicious', details:extracted, original:match, reason:'same_amount_same_day', message:'⚠️ Same amount already received today via same method - needs manual review' })
          }
        }
      } catch {}
    }

    // STEP 7 — Visual pHash (last resort)
    const { data:allPayments } = await supabase.from('payments').select('*').eq('payment_method',paymentMethod).not('phash','is',null)
    if (allPayments?.length > 0) {
      let highSim=0, highMatch=null
      for (const p of allPayments) {
        if (!p.phash||p.image_hash===imageHash) continue
        const sim = similarity(phash, p.phash)
        if (sim>highSim) { highSim=sim; highMatch=p }
      }
      if (highMatch && highSim>=checks.dupThresh)  return res.json({ status:'duplicate',  details:highMatch, original:highMatch, similarity:Math.round(highSim), reason:'visual_duplicate', message:`❌ Visually identical screenshot already uploaded! (${Math.round(highSim)}% match)` })
      if (highMatch && highSim>=checks.cropThresh) return res.json({ status:'suspicious', details:highMatch, original:highMatch, similarity:Math.round(highSim), reason:'possible_crop',    message:`⚠️ This may be a cropped version of an existing screenshot (${Math.round(highSim)}% match) - needs manual review` })
    }

    // STEP 8 — Upload to storage
    const fileName = `${Date.now()}-${file.originalFilename||'screenshot'}`
    const { error:upErr } = await supabase.storage.from('Screenshots').upload(fileName, buf, { contentType:mime })
    fs.unlink(file.filepath, ()=>{})
    if (upErr) return res.status(500).json({ status:'error', message:`Screenshot upload failed: ${upErr.message}` })

    const { data:{ publicUrl } } = supabase.storage.from('Screenshots').getPublicUrl(fileName)

    // STEP 9 — Save to DB with pending_review status
    const { data:inserted, error:insErr } = await supabase.from('payments').insert([{
      transaction_id: extracted.transaction_id,
      amount: normAmt ? `$${normAmt}` : extracted.amount,
      sender_name: extracted.sender_name,
      receiver_name: 'UNKNOWN',
      memo: extracted.memo,
      date_time: extracted.date_time,
      payment_method: paymentMethod,
      screenshot_url: publicUrl,
      image_hash: imageHash,
      phash: phash,
      uploaded_by: uploaderName,
      agent_email: uploaderName,
      status: 'verified',
      approval_status: 'pending_review',
    }]).select().single()

    if (insErr) return res.status(500).json({ status:'error', message:`Failed to save payment: ${insErr.message}` })

    // STEP 10 — Notify finance team
    await notifyFinance(paymentMethod, uploaderName, inserted.id)

    return res.json({ status:'verified', details:extracted, message:'✅ Payment verified and sent to finance for approval!' })

  } catch (err) {
    console.error('Error:', err)
    return res.status(500).json({ status:'error', message:err.message })
  }
}
