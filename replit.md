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
- **CommunicateButton** — `src/components/Email/CommunicateButton.tsx` — WhatsApp/Email choice popup on Contract/Letter/Payment pages
- **PDF Attachment Without Save** — PDF generators return base64 string; email compose can include the document PDF
- **Gmail Email Sending** — Emails sent via Gmail API using Google OAuth credentials. Requires `gmail.send` scope
- **Gmail Attachment Picker** — In ComposeModal, "From Gmail (recent)" lists PDF attachments from the last 3 days
- **Gmail Push** — Cloud Pub/Sub webhook at `/api/gmail/push` for true push delivery
- **Sales / Lead IQ** — `SalesPage.tsx` with LWG lead import, per-lead cold email compose, bulk cold email modal
- **PWA** — Service worker for offline support and push notifications

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite (port 5000)
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM v6
- **Backend/Auth/DB**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Server**: Express.js on port 3001 (proxied by Vite on port 5000) — handles Gmail OAuth, Zoho Mail OAuth, email sending, PDF downloads, LWG scraping
- **Notifications**: Firebase Cloud Messaging (optional — degrades gracefully if not configured)
- **Documents**: jsPDF, jspdf-autotable, docxtemplater, pizzip

## Running the App

```bash
npm run dev
```

Starts both the Vite dev server (port 5000) and Express API server (port 3001) concurrently.

## Replit Architecture

- **Workflow**: `Start application` runs `npm run dev` (Vite on port 5000, Express on port 3001)
- **Production deploy**: `NODE_ENV=production node server/index.js` — Express serves built `dist/` with SPA fallback
- **Live secrets**: `server/replitSecrets.js` watches `/run/replit/env/latest.json` for live Replit secret updates without workflow restarts
- **OAuth redirect URI**: Uses `REPLIT_DEV_DOMAIN` / `REPLIT_DOMAINS` env vars (auto-set by Replit) for correct redirect URIs in Google and Zoho OAuth flows
- **Vite proxy**: `/api/*` requests from the frontend are proxied to `http://localhost:3001`

## Required Replit Secrets

All secrets are stored in Replit Secrets (Secrets tab), never in `.env` files:

| Secret | Purpose |
|--------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (Gmail sync + send) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REFRESH_TOKEN` | Google refresh token (via `/api/google/oauth/start`) |
| `ZOHO_CLIENT_ID` | Zoho Developer Console Web app Client ID (optional) |
| `ZOHO_CLIENT_SECRET` | Zoho Client Secret (optional) |
| `ZOHO_REFRESH_TOKEN` | Zoho refresh token via `/api/zoho/oauth/start` (optional) |
| `ZOHO_FROM_EMAIL` | The Zoho Mail address to send from (optional) |
| `ZOHO_FROM_NAME` | Display name for outgoing Zoho emails (optional) |
| `ZOHO_AUTH_BASE` | Zoho auth DC base URL, default `https://accounts.zoho.com` (optional) |
| `ZOHO_API_BASE` | Zoho API DC base URL, default `https://mail.zoho.com` (optional) |

Firebase variables (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_VAPID_KEY`) are optional — app degrades gracefully without them.

AI keys (Google Gemini / Qwen DashScope) are stored in the user's browser localStorage via the Settings page — no server secret needed.

## Project Structure

```
src/
  components/     # UI components by feature
    Auth/         # LoginPage, ProtectedRoute, NotificationInitializer
    Layout/       # Layout, Sidebar, MobileBottomNav
    Home/         # HomePage + widgets
    Contracts/    # ContractsPage, ContractForm, DebitNotesSection, InvoicesSection
    ContactBook/  # ContactBookPage + modals
    DebitNote/    # DebitNotePage + form
    SampleBook/   # SampleBookPage + list/form
    Approvals/    # ApprovalsPage
    Sales/        # SalesPage + lead/email modals
    Email/        # ComposeModal, RichTextEditor, CommunicateButton, EmailLog
    EmailTemplates/ # EmailTemplatesPage, TemplateForm
    Journal/      # JournalEntryCard, JournalEntryForm, JournalEntryPopup
    Notes/        # NotesPage
    Settings/     # SettingsPage + email/Gmail/Zoho setup sections
    UI/           # Shared UI (dialogs, loading screen, error boundary, notification bell)
  hooks/          # useAuth, useNotifications, useReminderChecker
  lib/            # supabaseClient.ts, firebase.ts, courierTracking.ts, emailSync.ts, emailCompose.ts, dialogService.ts
  types/          # TypeScript interfaces (index.ts)
  utils/          # contractPdfGenerator, debitNotePdfGenerator, samplePdfGenerator, contractWordGenerator, debitNoteWordGenerator, pwaHelper, timezoneHelper
  App.tsx         # Router + route definitions
  main.tsx        # Bootstrap, service worker registration
server/
  index.js        # Express API server (Gmail, Zoho, email send, PDF download, LWG scraper)
  gmailLib.js     # Gmail OAuth token management, email fetching/sending
  zohoLib.js      # Zoho Mail OAuth and email sending
  pdfLinks.js     # In-memory PDF link store for download tokens
  replitSecrets.js # Live-reloads Replit secrets from /run/replit/env/latest.json
supabase/
  functions/      # Edge Functions: check-reminders (FCM push), onesignal-proxy
  migrations/     # Full SQL schema history (contracts, samples, debit_notes, companies, invoices, leads, etc.)
public/           # Static assets: icons, service workers (sw.js, firebase-messaging-sw.js), manifest
```

## Database (Supabase)

The app uses an external Supabase project for PostgreSQL, Auth, and Storage. Key tables:
- `contracts`, `contract_files`, `contract_samples` — core business contracts
- `samples` — leather sample tracking
- `debit_notes` — commission debit notes
- `companies` — supplier/buyer companies
- `contact_book` — business contacts
- `invoices`, `email_scan_log` — invoice auto-sync pipeline
- `leads`, `call_logs`, `lead_email_logs` — sales CRM
- `email_templates`, `email_logs` — email system
- `todos`, `journal_entries` — productivity tools
- `gmail_push_state` — Gmail push webhook state

All tables use Row Level Security (RLS) with Supabase Auth JWT.

## AI Providers for Invoice Extraction

- **Google AI Studio (Gemini)** — direct API, native PDF reading, 1500 req/day free. Recommended. User sets key in Settings → stored in localStorage as `jild_google_api_key`
- **Qwen / DashScope (Alibaba)** — backup. User sets key in Settings → stored in localStorage as `jild_qwen_api_key`

## Invoice Approval Flow

Email sync NEVER writes directly to `invoices`. Extracted invoices are staged in `email_scan_log.extracted_invoices`. The user approves them on the Approvals page → calls `emailSync.approveExtractedInvoice` → inserts into `invoices` with `is_approved=true, source='email_sync'`.

## Sample Courier Tracking

`src/lib/courierTracking.ts` supports DHL, FedEx, UPS, Aramex, BlueDart, DTDC, India Post, TNT — builds tap-to-track URLs for each provider.
