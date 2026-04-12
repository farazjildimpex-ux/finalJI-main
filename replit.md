# JILD IMPEX Management Portal

A leather import/export business management system for JILD IMPEX, Chennai.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend/Auth/Database**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Push Notifications**: Firebase Cloud Messaging (optional)
- **PDF Generation**: jsPDF + jsPDF AutoTable
- **Routing**: React Router DOM v6

## Features

- **Contracts**: Create and manage leather supply contracts with PDF export
- **Sample Book**: Track leather samples with shipment references
- **Debit Notes**: Commission calculations with currency conversion and PDF export
- **Contact Book**: Centralized business contact directory
- **Journal & Reminders**: Time-based reminder system with FCM push notifications
- **Dashboard**: Recent activity overview across all modules

## Environment Variables (Replit Secrets)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL (Settings → API) |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key (Settings → API) |
| `VITE_FIREBASE_API_KEY` | No | Firebase API key (for push notifications) |
| `VITE_FIREBASE_AUTH_DOMAIN` | No | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | No | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | No | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | No | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | No | Firebase app ID |
| `VITE_FIREBASE_VAPID_KEY` | No | Firebase VAPID key for web push |

## Running the App

```
npm run dev
```

Runs on port 5000. The workflow "Start application" is configured to auto-start.

## Project Structure

```
src/
  App.tsx               # Root router
  components/
    Auth/               # Login page, protected routes, notification init
    Contracts/          # Contract management
    DebitNote/          # Debit note / payment management
    SampleBook/         # Leather sample tracking
    ContactBook/        # Contact directory
    Home/               # Dashboard
    Journal/            # Journal entries & reminders
    Layout/             # Sidebar, navigation
    Settings/           # App settings
  hooks/
    useAuth.ts          # Supabase auth state
    useNotifications.ts # FCM push notification setup
    useReminderChecker.ts # Reminder polling
  lib/
    supabaseClient.ts   # Supabase client init
    firebase.ts         # Firebase/FCM init
  types/
    index.ts            # Shared TypeScript interfaces
supabase/
  migrations/           # PostgreSQL schema migrations
  functions/            # Deno edge functions (check-reminders, onesignal-proxy)
```

## Notes

- Firebase/push notifications are optional — the app works fully without them
- Supabase Edge Functions (`check-reminders`, `onesignal-proxy`) are deployed separately to Supabase
- The Replit-provisioned PostgreSQL database is present but not actively used — Supabase is the data layer
