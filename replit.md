# JILD IMPEX Office App

A management portal for JILD IMPEX, a leather import/export business based in Chennai, India.

## Features
- **Contracts Management** — Create, manage, and export leather supply contracts to PDF/Word
- **Sample Book** — Track leather samples and shipment references
- **Debit Notes** — Calculate commissions with currency conversion, export documents
- **Contact Book** — Directory for business contacts and clients (with contact_person + email_cc fields)
- **Journal & Reminders** — Daily entries with time-based push notification reminders
- **Auto Invoice Sync** — Connects to Gmail via IMAP, downloads PDF attachments from the last 7 days, uses OpenRouter AI to extract invoice data, and upserts into Supabase
- **Email System** — Zoho Mail OAuth sending, Email Templates CRUD with `{{variable}}` substitution, ComposeModal reusable component, email buttons on Contract/Letter/Payment pages, email log history
- **Gmail Push** — Cloud Pub/Sub webhook at `/api/gmail/push` for true push delivery (no polling)
- **PWA** — Service worker for offline support and push notifications

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite (port 5000)
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM v6
- **Backend/Auth/DB**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Notifications**: Firebase Cloud Messaging (optional — degrades gracefully if not configured)
- **Documents**: jsPDF, jspdf-autotable, docxtemplater, pizzip

## Environment Variables (Secrets)
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous/public key
- `GOOGLE_CLIENT_ID` — OAuth 2.0 Web Application Client ID from Google Cloud Console (Gmail API enabled)
- `GOOGLE_CLIENT_SECRET` — OAuth 2.0 Client Secret matching the Client ID above
- `GOOGLE_REFRESH_TOKEN` — long-lived refresh token obtained via the in-app `/api/google/oauth/start` flow (one-time)
- `ZOHO_CLIENT_ID` — Zoho Developer Console Web app Client ID
- `ZOHO_CLIENT_SECRET` — Zoho Client Secret
- `ZOHO_REFRESH_TOKEN` — Zoho refresh token obtained via `/api/zoho/oauth/start` (one-time)
- `ZOHO_FROM_EMAIL` — The Zoho Mail address to send from
- `ZOHO_ACCOUNT_ID` — (optional) Zoho numeric account ID; auto-fetched and cached if omitted
- `ZOHO_AUTH_BASE` — (optional) Zoho auth DC base URL, defaults to `https://accounts.zoho.com`
- `ZOHO_API_BASE` — (optional) Zoho API DC base URL, defaults to `https://mail.zoho.com`
- Firebase variables are optional (set in `.env.example` for reference)

## Architecture: Auto Invoice Sync
- **Email Access**: Uses Gmail's official REST API with OAuth 2.0 (scope `gmail.readonly`). The app implements a self-contained OAuth flow at `/api/google/oauth/start` → Google consent → `/api/google/oauth/callback` which displays the refresh token for the user to save as an env var. Access tokens (1-hour TTL) are cached and refreshed automatically. Replit-managed Gmail connectors are paid-only, so manual OAuth was chosen.
- **Why not App Passwords / IMAP**: Google App Passwords are unavailable on many Workspace and consumer accounts. OAuth works on every Gmail/Workspace account.
- **PDF Parsing**: `pdf-parse` v2 (`new PDFParse({ data }).getText()`) — note: v2 has a class-based API, NOT a function call.
- **Attachment walker**: `extractFromPayload` handles forwarded emails (message/rfc822), missing `filename` fields (read from Content-Disposition header), and PDFs labelled `application/octet-stream`. Belt-and-suspenders sanitizers in `src/lib/emailSync.ts` strip header-label colors (COL/SHADE/etc.) and unit suffixes (sqft/pcs) from AI output.
- **AI Extraction**: OpenRouter API (user-supplied key, stored in localStorage) analyzes email body + PDF text to extract invoice fields. Notes are always saved blank for manual entry.
- **Data Storage**: Supabase `invoices` table, upserted by invoice number.

## Architecture: Replit Hosting
The backend is `server/index.js` (Express on port 3001, proxied by Vite on port 5000).
- `server/replitSecrets.js` watches `/run/replit/env/latest.json` for live secret updates without workflow restarts.
- Redirect URI for Google OAuth uses the `REPLIT_DOMAINS` env var (auto-set by Replit).
- In production (`NODE_ENV=production`), Express also serves the built `dist/` SPA with SPA fallback.

### Required Replit Secrets
All secrets are stored in Replit Secrets (not `.env` files):
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous/public key
- `GOOGLE_CLIENT_ID` — Google OAuth client ID (Gmail sync)
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret
- `GOOGLE_REFRESH_TOKEN` — Google refresh token (obtained via `/api/google/oauth/start`)
- `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_FROM_EMAIL` — Zoho Mail (optional)
- `VITE_FIREBASE_*` — Firebase FCM (optional — app degrades gracefully without these)

### Required Google Cloud config
Add `https://<your-replit-domain>/api/google/oauth/callback` to the OAuth client's "Authorized redirect URIs" list in Google Cloud Console.

## Running
```
npm run dev
```
Starts the Vite dev server on port 5000.

## Project Structure
```
src/
  components/     # UI components by feature (Auth, Contracts, DebitNote, Approvals, etc.)
  hooks/          # useAuth, useNotifications, useReminderChecker
  lib/            # supabaseClient.ts, firebase.ts, courierTracking.ts, emailSync.ts
  types/          # TypeScript interfaces
  utils/          # PDF/Word generators, PWA helpers
  App.tsx         # Router + route definitions (includes /app/approvals)
  main.tsx        # Bootstrap, service worker registration
supabase/
  functions/      # Edge Functions (check-reminders, onesignal-proxy)
  migrations/     # SQL schema history
```

## AI providers for invoice extraction (emailSync.ts)
- **Google AI Studio (Gemini)** — direct API, native PDF reading, 1500 req/day free. Recommended.
- **Qwen / DashScope (Alibaba)** — backup. OpenAI-compatible endpoint at
  `https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions`. Vision models (`qwen-vl-max-latest`)
  read scanned PDFs via `image_url` data URIs. Key from bailian.console.aliyun.com.
- OpenRouter was removed (April 2026) — quota was unreliable.

## Invoice approval flow (April 30, 2026 — staging-based)
- Email sync NEVER writes to `invoices` directly. `emailSync.previewOne` only checks for duplicates and produces a preview `SyncResult`. The AI-extracted invoice JSON is stored in `email_scan_log.extracted_invoices` via `recordScan`.
- Approvals page at `/app/approvals` lists pending items by reading `email_scan_log.extracted_invoices` and excluding any `invoice_number` already present in `invoices`. On Approve it calls `emailSync.approveExtractedInvoice` which inserts into `invoices` with `is_approved=true, source='email_sync'`.
- `InvoicesSection` (contract page) filters out unapproved email-sync rows: `or('is_approved.eq.true,source.is.null,source.neq.email_sync')` so manual entries always show, sync entries only after approval.
- Migration `20260430000000_invoice_approval_and_courier.sql` provides the `is_approved`, `approved_at`, `approved_by`, `source` columns used above.

## PWA / SPA fallback
- `server/index.js` (production only) serves `dist/` static and falls back to `index.html` for any non-`/api/*` GET so refreshing `/app/home` (or any deep route) works in the installed PWA on Replit deployments.
- `netlify.toml` includes a `/* → /index.html (200)` redirect for the same reason on Netlify.
- Service worker version bumped to `v11-2026-04-30` to invalidate stale caches.

## Pull-to-refresh on Home
- `src/components/UI/PullToRefresh.tsx` is a touch-driven wrapper that listens on `window`. When the page is at scrollTop 0 and the user drags down past the threshold, it fires `onRefresh` and shows a full-screen splash (`RefreshSplash`) reusing the JI letter animation from `LoadingScreen.tsx`.
- `HomePage` wraps its tree in `<PullToRefresh onRefresh={...}>` and the refresh callback re-runs both `fetchData` (orders) and `fetchJournalEntries`.

## Sample courier tracking
- Same migration adds `courier_provider`, `courier_reference`, `courier_status`, `delivered_at`, `delivery_notified` to `samples`.
- `src/lib/courierTracking.ts` lists supported couriers (DHL, FedEx, UPS, Aramex, BlueDart, DTDC, India Post, TNT, Other) and builds tap-to-track URLs.
- `SampleForm.tsx` has a "Courier & Tracking" section with provider dropdown, AWB field, "Track" button (opens public tracker), latest-status text input, and "Mark Delivered" button (sets `delivered_at`, status = Completed).

## Journal reminder quick-pick buttons
`JournalEntryForm.tsx` shows 6 preset buttons (2 days, 1 week, 10 days, 2 weeks, 3 weeks, 4 weeks) when reminders are enabled. Each preset sets `reminderDate = today + N days` and `reminderTime = 09:00`.
