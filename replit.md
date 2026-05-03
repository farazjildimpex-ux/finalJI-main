# JILD IMPEX Office App

A management portal for JILD IMPEX, a leather import/export business based in Chennai, India.

## Features
- **Contracts Management** — Create, manage, and export leather supply contracts to PDF/Word
- **Sample Book** — Track leather samples and shipment references
- **Debit Notes** — Calculate commissions with currency conversion, export documents
- **Contact Book** — Directory for business contacts and clients (with contact_person + email_cc fields)
- **Journal & Reminders** — Daily entries with time-based push notification reminders
- **Auto Invoice Sync** — Connects to Gmail via OAuth, downloads PDF attachments from the last 7 days, uses Google Gemini or Qwen AI to extract invoice data, stages for approval
- **Email System** — Zoho Mail OAuth sending, Email Templates CRUD with `{{variable}}` substitution, ComposeModal with rich-text editor (bold/italic/underline/font size/color), email log history
- **Rich Text Email Editor** — `src/components/Email/RichTextEditor.tsx` — contenteditable toolbar with formatting
- **CommunicateButton** — `src/components/Email/CommunicateButton.tsx` — WhatsApp/Email choice popup on Contract/Letter/Payment pages
- **PDF Attachment Without Save** — PDF generators accept a `download` boolean and return base64 string
- **Gmail Attachment Picker** — In ComposeModal, "From Gmail (recent)" lists PDF attachments from last 3 days
- **Gmail Push** — Cloud Pub/Sub webhook at `/api/gmail/push` for true push delivery
- **Zoho Setup Guide** — `src/components/Settings/ZohoSetupSection.tsx` — step-by-step setup instructions with live connection status badge
- **Mobile Nav** — MobileBottomNav shows 7 items with horizontal scroll (Home, Contacts, Contracts, Letters, Payments, Templates, Data)
- **PWA** — Service worker for offline support and push notifications

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite (port 5000)
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM v6
- **Backend/Auth/DB**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Server**: Express.js on port 3001 (proxied by Vite) — handles Gmail OAuth, Zoho Mail OAuth, email sending
- **Notifications**: Firebase Cloud Messaging (optional — degrades gracefully if not configured)
- **Documents**: jsPDF, jspdf-autotable, docxtemplater, pizzip

## Running the App

```bash
npm run dev
```

Starts both the Vite dev server (port 5000) and Express API server (port 3001) concurrently.

## Architecture: Replit Hosting

The backend is `server/index.js` (Express on port 3001, proxied by Vite on port 5000).
- `server/replitSecrets.js` watches `/run/replit/env/latest.json` for live secret updates without workflow restarts
- Redirect URI for Google OAuth uses `REPLIT_DOMAINS` env var (auto-set by Replit)
- In production (`NODE_ENV=production`), Express serves the built `dist/` SPA with SPA fallback

## Required Replit Secrets

All secrets are stored in Replit Secrets (not `.env` files):

| Secret | Purpose |
|--------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (Gmail sync) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REFRESH_TOKEN` | Google refresh token (via `/api/google/oauth/start`) |
| `ZOHO_CLIENT_ID` | Zoho Developer Console Web app Client ID |
| `ZOHO_CLIENT_SECRET` | Zoho Client Secret |
| `ZOHO_REFRESH_TOKEN` | Zoho refresh token (via `/api/zoho/oauth/start`) |
| `ZOHO_FROM_EMAIL` | The Zoho Mail address to send from |
| `ZOHO_FROM_NAME` | Display name for outgoing Zoho emails |
| `ZOHO_AUTH_BASE` | (optional) Zoho auth DC base URL, defaults to `https://accounts.zoho.com` |
| `ZOHO_API_BASE` | (optional) Zoho API DC base URL, defaults to `https://mail.zoho.com` |

Firebase variables (`VITE_FIREBASE_*`) are optional — app degrades gracefully without them.

## Project Structure

```
src/
  components/     # UI components by feature (Auth, Contracts, DebitNote, Approvals, etc.)
  hooks/          # useAuth, useNotifications, useReminderChecker
  lib/            # supabaseClient.ts, firebase.ts, courierTracking.ts, emailSync.ts, emailCompose.ts
  types/          # TypeScript interfaces
  utils/          # PDF/Word generators, PWA helpers
  App.tsx         # Router + route definitions
  main.tsx        # Bootstrap, service worker registration
server/
  index.js        # Express API server (Gmail, Zoho, email send endpoints)
  gmailLib.js     # Gmail OAuth token management and email fetching
  zohoLib.js      # Zoho Mail OAuth and email sending
  replitSecrets.js # Live-reloads Replit secrets from env file
supabase/
  functions/      # Edge Functions (check-reminders, onesignal-proxy)
  migrations/     # SQL schema history
```

## AI Providers for Invoice Extraction

- **Google AI Studio (Gemini)** — direct API, native PDF reading, 1500 req/day free. Recommended.
  User sets key in Settings → stored in localStorage as `jild_google_api_key`
- **Qwen / DashScope (Alibaba)** — backup. OpenAI-compatible at DashScope International.
  User sets key in Settings → stored in localStorage as `jild_qwen_api_key`

## Invoice Approval Flow

Email sync NEVER writes directly to `invoices`. Extracted invoices are staged in `email_scan_log.extracted_invoices` via `recordScan`. The user approves them on the Approvals page (`/app/approvals`) which calls `emailSync.approveExtractedInvoice` → inserts into `invoices` with `is_approved=true, source='email_sync'`.

## PWA / SPA Fallback

`server/index.js` (production only) serves `dist/` static and falls back to `index.html` for any non-`/api/*` GET so refreshing deep routes works in the installed PWA.

## Sample Courier Tracking

`src/lib/courierTracking.ts` supports DHL, FedEx, UPS, Aramex, BlueDart, DTDC, India Post, TNT, and builds tap-to-track URLs for each provider.

## Journal Reminder Quick-Pick Buttons

`JournalEntryForm.tsx` shows 6 preset buttons (2 days, 1 week, 10 days, 2 weeks, 3 weeks, 4 weeks) when reminders are enabled. Each preset sets `reminderDate = today + N days` and `reminderTime = 09:00`.
