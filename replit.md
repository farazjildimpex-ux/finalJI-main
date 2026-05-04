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
- **Rich Text Email Editor** — `src/components/Email/RichTextEditor.tsx` — contenteditable toolbar with formatting, preview uses app system font
- **CommunicateButton** — `src/components/Email/CommunicateButton.tsx` — WhatsApp/Email choice popup on Contract/Letter/Payment pages. WhatsApp flow generates a pre-filled message and opens wa.me. Email flow opens template picker → ComposeModal.
- **PDF Attachment Without Save** — PDF generators (`contractPdfGenerator`, `samplePdfGenerator`, `debitNotePdfGenerator`) now accept a `download` boolean and return base64 string. Email compose can include the document PDF via a download link.
- **Gmail Email Sending** — Emails are sent via Gmail API (`POST /gmail/v1/users/me/messages/send`) using the same Google OAuth credentials as invoice sync. Builds RFC 2822 MIME multipart messages with real PDF attachments (base64, `Content-Transfer-Encoding: base64`). Requires `gmail.send` scope — user must re-authorize Google once via Settings → Email. `sendGmailEmail()` in `server/gmailLib.js`.
- **Gmail Attachment Picker** — In ComposeModal, "From Gmail (recent)" lists PDF attachments from the last 3 days, then fetches the selected one's base64.
- **Gmail Push** — Cloud Pub/Sub webhook at `/api/gmail/push` for true push delivery (no polling)
- **Zoho Setup Guide** — `src/components/Settings/ZohoSetupSection.tsx` — step-by-step setup instructions with live connection status badge. Added to Settings page.
- **Mobile Nav** — `MobileBottomNav` shows 7 items (Home, Contacts, Contracts, Letters, Payments, Templates, Data) with horizontal scroll. Templates tab navigates to `/app/email-templates`.
- **Template Edit Modal** — `EmailTemplatesPage` now opens the TemplateForm in a modal overlay (not inline), preventing duplicate-entry confusion.
- **Sales / Lead IQ** — `SalesPage.tsx` with LWG lead import, per-lead cold email compose, and bulk cold email modal (country filter, template picker, per-lead variable substitution, progress bar, logs to `lead_email_logs`, updates lead status to "contacted").
- **PWA** — Service worker for offline support and push notifications

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite (port 5000)
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM v6
- **Backend/Auth/DB**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Server**: Express.js on port 3001 (proxied by Vite on port 5000) — handles Gmail OAuth, Zoho Mail OAuth, email sending
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
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (Gmail sync + send) |
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

## Environment Variables (Secrets) — full list

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous/public key
- `GOOGLE_CLIENT_ID` — OAuth 2.0 Web Application Client ID from Google Cloud Console (Gmail API enabled)
- `GOOGLE_CLIENT_SECRET` — OAuth 2.0 Client Secret matching the Client ID above
- `GOOGLE_REFRESH_TOKEN` — long-lived refresh token obtained via the in-app `/api/google/oauth/start` flow (one-time)
- `ZOHO_CLIENT_ID` — Zoho Developer Console Web app Client ID
- `ZOHO_CLIENT_SECRET` — Zoho Client Secret
- `ZOHO_REFRESH_TOKEN` — Zoho refresh token obtained via `/api/zoho/oauth/start` (one-time)
- `ZOHO_FROM_EMAIL` — The Zoho Mail address to send from
- `ZOHO_FROM_NAME` — Display name shown to recipients (e.g. "JILD IMPEX")
- `ZOHO_ACCOUNT_ID` — (optional) Zoho numeric account ID; auto-fetched and cached if omitted
- `ZOHO_AUTH_BASE` — (optional) Zoho auth DC base URL, defaults to `https://accounts.zoho.com`
- `ZOHO_API_BASE` — (optional) Zoho API DC base URL, defaults to `https://mail.zoho.com`
- Firebase variables are optional (set in `.env.example` for reference)

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
  gmailLib.js     # Gmail OAuth token management and email fetching/sending
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

## Lead / Sales System

- `lead_email_logs` Supabase table tracks every outbound cold email (user_id, lead_id, to_email, subject, body, status, sent_at)
- Leads are imported from the Leather Working Group (LWG) directory via `LWGScraperModal`
- Cold emails send via `POST /api/email/send` → `sendGmailEmail()` using office@jildimpex.com
- Bulk cold email modal: country filter, lead checklist, template picker, per-lead `{{variable}}` substitution, progress bar, auto-marks leads as "contacted"
