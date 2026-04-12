# JILD IMPEX Office App

## Project Overview
A leather trade management system for JILD IMPEX. Built as a pure frontend React SPA using Vite + TypeScript + Tailwind CSS. Authentication and database are handled entirely through Supabase (no Node.js backend).

## Architecture
- **Frontend**: Vite + React 18 + TypeScript + Tailwind CSS
- **Auth & Database**: Supabase (direct from frontend)
- **Routing**: React Router v6
- **PDF Generation**: jsPDF + jsPDF-AutoTable
- **Icons**: Lucide React

## Key Modules
- **Contracts** — Create and manage leather trade contracts with file attachments
- **Sample Book** — Track fabric/leather samples with status (Issued/Completed)
- **Debit Notes** — Generate and manage debit notes with commission calculations
- **Contact Book** — Manage suppliers, buyers and contacts
- **Journal** — Private journal with reminders and file attachments
- **Home** — Dashboard with recent orders, todos, and search

## Environment Variables (Secrets)
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key

## Running the App
- **Dev**: `npm run dev` (runs on port 5000)
- **Build**: `npm run build`

## Replit Configuration
- Vite dev server configured for `host: 0.0.0.0`, `port: 5000`, `allowedHosts: true`
- Workflow: "Start application" runs `npm run dev`, webview on port 5000
- Deployment: static site, output in `dist/`

## Supabase Schema (key tables)
- `contracts` — trade contracts with multi-value array fields
- `samples` — sample records with status tracking
- `debit_notes` — debit notes with commission calculations
- `contract_files` — file attachments linked to contracts
- `companies` — supplier/buyer company records
- `contact_book` — contact directory
- `todos` — user-specific task list
- `journal_entries` — private journal with reminders

## Notes
- All Supabase tables use Row Level Security (RLS)
- The app uses Supabase Auth — users must be created in the Supabase dashboard
- Supabase Edge Functions (check-reminders, onesignal-proxy) remain deployed on Supabase separately
