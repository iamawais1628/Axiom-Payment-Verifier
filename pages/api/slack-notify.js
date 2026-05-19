export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { type, data } = req.body
  const webhookUrl = process.env.SLACK_WEBHOOK_URL

  if (!webhookUrl) {
    return res.json({ success: false, note: 'SLACK_WEBHOOK_URL not configured' })
  }

  let text = ''
  let color = '#2563eb'

  switch (type) {
    case 'payment_submitted':
      color = '#f59e0b'
      text = `📤 *New Payment Submitted*\n*Method:* ${data.method}\n*Amount:* ${data.amount}\n*Sender:* ${data.sender}\n*By:* ${data.agent}\n${data.note ? `*Note:* ${data.note}` : ''}`
      break
    case 'payment_approved':
      color = '#16a34a'
      text = `✅ *Payment Approved*\n*Method:* ${data.method}\n*Amount:* ${data.amount}\n*Agent:* ${data.agent}\n*Approved by:* ${data.reviewer}`
      break
    case 'payment_rejected':
      color = '#dc2626'
      text = `❌ *Payment Rejected*\n*Method:* ${data.method}\n*Amount:* ${data.amount}\n*Agent:* ${data.agent}\n*Rejected by:* ${data.reviewer}\n*Reason:* ${data.reason || 'No reason provided'}`
      break
    case 'duplicate_detected':
      color = '#ef4444'
      text = `🚨 *Duplicate Payment Detected!*\n*Method:* ${data.method}\n*Amount:* ${data.amount}\n*Submitted by:* ${data.agent}\n*Reason:* ${data.reason}`
      break
    case 'tag_updated':
      color = '#8b5cf6'
      text = `🏷️ *Tag Updated*\n*Method:* ${data.method}\n*New Tag:* ${data.tag}\n*Updated by:* ${data.updatedBy}`
      break
    case 'tag_requested':
      color = '#f59e0b'
      text = `📨 *Tag Requested*\n*Method:* ${data.method}\n*Requested by:* ${data.agent}`
      break
    default:
      text = `📌 ${type}: ${JSON.stringify(data)}`
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: [{
          color,
          text,
          footer: 'Payment Verifier',
          ts: Math.floor(Date.now() / 1000),
        }]
      })
    })

    if (!response.ok) throw new Error(`Slack error: ${response.status}`)
    return res.json({ success: true })
  } catch (err) {
    console.error('Slack webhook error:', err)
    return res.json({ success: false, error: err.message })
  }
}
