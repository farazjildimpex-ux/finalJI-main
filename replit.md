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
- `GMAIL_USER` — Gmail address that receives forwarded invoices (e.g. `you@gmail.com`)
- `GMAIL_APP_PASSWORD` — 16-character Google App Password (created at https://myaccount.google.com/apppasswords; requires 2-Step Verification)
- Firebase variables are optional (set in `.env.example` for reference)

## Architecture: Auto Invoice Sync
- **Email Access**: Uses IMAP (imapflow + mailparser) with a Google App Password to connect to `imap.gmail.com:993`. All Zoho invoices are forwarded to the configured Gmail address; this app reads them centrally from one inbox.
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
