# 🛡️ Payment Verifier

AI-powered payment screenshot fraud detection with team workflow, finance approval, and tag management.

---

## Features

- **AI Fraud Detection** — Detects duplicate, cropped, and fake payment screenshots
- **Finance Approval Workflow** — Agents submit → Finance approves/rejects → Agent sees status in real-time
- **Tag Directory** — Finance publishes payment tags (CashApp $tag, Zelle email, etc.) for agents to use
- **Tag Requests** — Agents request missing tags, finance gets notified instantly
- **Real-time Notifications** — Bell icon updates live via Supabase Realtime
- **Role-based Access** — Agent / Finance / Admin roles

---

## Tech Stack

- **Frontend**: Next.js 14, React
- **Database + Auth + Storage + Realtime**: Supabase
- **AI Vision**: Groq (Llama 4 Scout)
- **Image Processing**: Sharp (pHash for visual duplicate detection)

---

## Setup

### Step 1 — Clone & Install

```bash
git clone <your-repo>
cd payment-verifier
npm install
```

### Step 2 — Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
GROQ_API_KEY=your_groq_api_key_here
```

**Getting your keys:**
- Supabase: https://supabase.com → your project → Settings → API
- Groq: https://console.groq.com → API Keys

### Step 3 — Run Database Schema

1. Go to your Supabase project
2. Open **SQL Editor**
3. Paste the entire contents of `schema.sql`
4. Click **Run**

### Step 4 — Create Supabase Storage Bucket

1. Go to **Storage** in Supabase
2. Click **New bucket**
3. Name it exactly: `Screenshots`
4. Set to **Public**
5. Click **Create**

### Step 5 — Create Users

1. Go to **Authentication → Users** in Supabase
2. Click **Add user** for each team member
3. After creating, go to the `profiles` table
4. Set the `role` column:
   - Agents: `agent`
   - Finance members: `finance`
   - Admin: `admin`
5. For finance members, set `payment_methods` array:
   - Example: `{CashApp,Zelle}` for someone who handles CashApp and Zelle
   - Leave empty `{}` to handle all methods

### Step 6 — Run

```bash
npm run dev
```

Open http://localhost:3000

---

## Pages

| Page | URL | Who |
|------|-----|-----|
| Login | `/login` | Everyone |
| Upload & Verify | `/upload` | Agents |
| My Payments | `/my-payments` | Agents — see their own submissions + approval status |
| Tags | `/tags` | Everyone — agents see/copy/request tags, finance sets them |
| Finance Queue | `/finance` | Finance — approve/reject payments |
| Dashboard | `/dashboard` | Everyone — full payment history |

---

## User Flow

### Agent
1. Go to `/tags` → copy the tag for the payment method you need
2. Send money to that tag
3. Go to `/upload` → upload the screenshot
4. Go to `/my-payments` → watch status update from **Pending** → **Approved** / **Rejected** in real-time

### Finance
1. Receive notification when agent submits a payment
2. Go to `/finance` → see pending payments for your assigned methods
3. Click a payment → view details + screenshot → **Approve** or **Reject** with reason
4. Agent gets notified instantly

### Tag Management
- Finance goes to `/tags` → click **Set Tag** / **Update Tag** on any method
- All agents are notified instantly when a tag is updated
- If an agent doesn't see a tag they need → click **Request Tag**
- Finance gets notified of the request → sets the tag → agent notified

---

## Fraud Detection Logic

The AI checks run in this order (fastest to most complex):

1. **MD5 Hash** — Exact same file byte-for-byte
2. **AI Extraction** — Pulls amount, sender, transaction ID, date from screenshot
3. **Age Check** — Screenshot older than allowed window (48-72h depending on method)
4. **Transaction ID** — Same ID already in database
5. **Amount + Sender** — Same person sent same amount before
6. **Amount + Date** — Same amount received same day via same method
7. **Visual pHash** — Visually similar image (catches resized/cropped versions)

---

## Deployment

### Vercel (recommended)

```bash
npm install -g vercel
vercel
```

Add environment variables in Vercel dashboard → Settings → Environment Variables.

---

## Support

Contact your admin for account access.
