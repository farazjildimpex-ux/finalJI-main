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
- **Email Access**: Uses Gmail's official REST API with OAuth 2.0 (scope `gmail.readonly`). The app implements a self-contained OAuth flow at `/api/google/oauth/start` → Google consent → `/api/google/oauth/callback` which displays the refresh token for the user to save as a Replit secret. The server caches access tokens (1-hour TTL) and refreshes them automatically. Replit-managed Gmail connectors are paid-only, so manual OAuth was chosen.
- **Why not App Passwords / IMAP**: Google App Passwords are unavailable on many Workspace and consumer accounts (page shows "not available for your account"). OAuth works on every Gmail/Workspace account.
- **Redirect URI**: built dynamically from the request host (`x-forwarded-proto` + `x-forwarded-host`). Must be added verbatim to the OAuth client's "Authorized redirect URIs" list in Google Cloud — the UI exposes the exact value to copy. Add both the Replit dev domain and the production `.replit.app` domain when deployed.
- **PDF Parsing**: pdf-parse extracts text from PDF attachments
- **AI Extraction**: OpenRouter API (user-supplied key, stored in localStorage) analyzes email body + PDF text to extract invoice fields
- **Data Storage**: Supabase `invoices` table, upserted by invoice number

## Running
```
npm run dev
```
Starts the Vite dev server on port 5000.

## Project Structure
```
src/
  components/     # UI components by feature (Auth, Contracts, DebitNote, etc.)
  hooks/          # useAuth, useNotifications, useReminderChecker
  lib/            # supabaseClient.ts, firebase.ts
  types/          # TypeScript interfaces
  utils/          # PDF/Word generators, PWA helpers
  App.tsx         # Router + route definitions
  main.tsx        # Bootstrap, service worker registration
supabase/
  functions/      # Edge Functions (check-reminders, onesignal-proxy)
  migrations/     # SQL schema history
```
