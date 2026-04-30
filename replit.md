# JILD IMPEX Office App

A management portal for JILD IMPEX, a leather import/export business based in Chennai, India.

## Features
- **Contracts Management** — Create, manage, and export leather supply contracts to PDF/Word
- **Sample Book** — Track leather samples and shipment references
- **Debit Notes** — Calculate commissions with currency conversion, export documents
- **Contact Book** — Directory for business contacts and clients
- **Journal & Reminders** — Daily entries with time-based push notification reminders
- **Auto Invoice Sync** — Connects to Gmail via IMAP, downloads PDF attachments from the last 7 days, uses OpenRouter AI to extract invoice data, and upserts into Supabase
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
- Firebase variables are optional (set in `.env.example` for reference)

## Architecture: Auto Invoice Sync
- **Email Access**: Uses Gmail's official REST API with OAuth 2.0 (scope `gmail.readonly`). The app implements a self-contained OAuth flow at `/api/google/oauth/start` → Google consent → `/api/google/oauth/callback` which displays the refresh token for the user to save as an env var. Access tokens (1-hour TTL) are cached and refreshed automatically. Replit-managed Gmail connectors are paid-only, so manual OAuth was chosen.
- **Why not App Passwords / IMAP**: Google App Passwords are unavailable on many Workspace and consumer accounts. OAuth works on every Gmail/Workspace account.
- **PDF Parsing**: `pdf-parse` v2 (`new PDFParse({ data }).getText()`) — note: v2 has a class-based API, NOT a function call.
- **Attachment walker**: `extractFromPayload` handles forwarded emails (message/rfc822), missing `filename` fields (read from Content-Disposition header), and PDFs labelled `application/octet-stream`. Belt-and-suspenders sanitizers in `src/lib/emailSync.ts` strip header-label colors (COL/SHADE/etc.) and unit suffixes (sqft/pcs) from AI output.
- **AI Extraction**: OpenRouter API (user-supplied key, stored in localStorage) analyzes email body + PDF text to extract invoice fields. Notes are always saved blank for manual entry.
- **Data Storage**: Supabase `invoices` table, upserted by invoice number.

## Architecture: Dual Hosting (Replit dev + Netlify production)
The backend exists in two parallel implementations sharing identical logic:
- **Local Replit dev**: `server/index.js` (Express on port 3001, proxied by Vite). `server/replitSecrets.js` watches `/run/replit/env/latest.json` for live secret updates without workflow restarts. Redirect URI uses `REPLIT_DOMAINS` env var.
- **Netlify production**: `netlify/functions/*.mjs` (one file per `/api/*` endpoint). Shared logic in `netlify/functions/_lib.mjs`. Routing in `netlify.toml` maps `/api/*` → `/.netlify/functions/*`. Redirect URI uses Netlify's `URL` / `DEPLOY_PRIME_URL` env var. `pdf-parse` is marked `external_node_modules` so its `pdf.worker.mjs` worker file isn't broken by esbuild bundling. PDF-parsing functions are configured for 26s timeout (Pro tier) — on Free tier they default to 10s.

### Required Netlify environment variables
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`. Netlify env vars take effect on next build only — must trigger a redeploy after editing them. The `/api/gmail/test` endpoint reflects this (no live watcher in production).

### Required Google Cloud config for Netlify
Add `https://<your-site>.netlify.app/api/google/oauth/callback` to the OAuth client's "Authorized redirect URIs" list. Keep the Replit dev URI listed too if you want OAuth to work locally during development.

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

## Invoice approval flow
- Migration `20260430000000_invoice_approval_and_courier.sql` adds `is_approved`, `approved_at`, `approved_by`, `source` to `invoices`.
- `emailSync.upsertOne` skips invoices where `is_approved = true` so user-confirmed records aren't overwritten on resync.
- Approvals page at `/app/approvals` (linked from Settings → "Invoice Approvals" card) lists `source = 'email_sync' AND is_approved = false` rows with Approve / Edit / Delete actions.

## Sample courier tracking
- Same migration adds `courier_provider`, `courier_reference`, `courier_status`, `delivered_at`, `delivery_notified` to `samples`.
- `src/lib/courierTracking.ts` lists supported couriers (DHL, FedEx, UPS, Aramex, BlueDart, DTDC, India Post, TNT, Other) and builds tap-to-track URLs.
- `SampleForm.tsx` has a "Courier & Tracking" section with provider dropdown, AWB field, "Track" button (opens public tracker), latest-status text input, and "Mark Delivered" button (sets `delivered_at`, status = Completed).

## Journal reminder quick-pick buttons
`JournalEntryForm.tsx` shows 6 preset buttons (2 days, 1 week, 10 days, 2 weeks, 3 weeks, 4 weeks) when reminders are enabled. Each preset sets `reminderDate = today + N days` and `reminderTime = 09:00`.
