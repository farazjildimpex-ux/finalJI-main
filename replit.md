# JILD IMPEX Office App

A management portal for JILD IMPEX, a leather import/export business based in Chennai, India.

## Features
- **Contracts Management** — Create, manage, and export leather supply contracts to PDF/Word
- **Sample Book** — Track leather samples and shipment references
- **Debit Notes** — Calculate commissions with currency conversion, export documents
- **Contact Book** — Directory for business contacts and clients
- **Journal & Reminders** — Daily entries with time-based push notification reminders
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
- Firebase variables are optional (set in `.env.example` for reference)

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
