"use client";

import React, { useState } from 'react';
import {
  Bell, ChevronDown, ChevronUp, ExternalLink, Copy, CheckCheck,
  AlertCircle, Terminal, Key, Database, Cloud, Smartphone,
} from 'lucide-react';

const STEPS = [
  {
    id: 'firebase-project',
    icon: Cloud,
    color: 'amber',
    title: 'Create a Firebase Project',
    summary: 'Set up the Firebase project that powers push notifications.',
    content: [
      {
        type: 'text' as const,
        text: 'Go to the Firebase Console and create a new project (or reuse an existing one).',
      },
      {
        type: 'link' as const,
        label: 'Open Firebase Console',
        href: 'https://console.firebase.google.com',
      },
      {
        type: 'bullets' as const,
        items: [
          'Click "Add project" and give it any name (e.g. JILD IMPEX)',
          'Google Analytics can be disabled — it is not needed',
          'Wait for the project to be created, then click "Continue"',
        ],
      },
    ],
  },
  {
    id: 'web-app',
    icon: Smartphone,
    color: 'blue',
    title: 'Register a Web App & Get Config Keys',
    summary: 'Add a web app to the project and copy the config object.',
    content: [
      {
        type: 'bullets' as const,
        items: [
          'In your Firebase project, click the </> (Web) icon on the project overview page',
          'Register the app with any nickname (e.g. "JILD Web")',
          'Skip "Firebase Hosting" — click "Register app"',
          'Copy the firebaseConfig object that appears',
        ],
      },
      {
        type: 'text' as const,
        text: 'The config contains these values — map them to Replit Secrets:',
      },
      {
        type: 'table' as const,
        rows: [
          ['Config key', 'Replit Secret name'],
          ['apiKey', 'VITE_FIREBASE_API_KEY'],
          ['authDomain', 'VITE_FIREBASE_AUTH_DOMAIN'],
          ['projectId', 'VITE_FIREBASE_PROJECT_ID'],
          ['storageBucket', 'VITE_FIREBASE_STORAGE_BUCKET'],
          ['messagingSenderId', 'VITE_FIREBASE_MESSAGING_SENDER_ID'],
          ['appId', 'VITE_FIREBASE_APP_ID'],
        ],
      },
      {
        type: 'link' as const,
        label: 'Open Replit Secrets tab',
        href: 'https://replit.com',
        note: 'Click the lock 🔒 icon in the left sidebar of this Repl',
      },
    ],
  },
  {
    id: 'vapid',
    icon: Key,
    color: 'violet',
    title: 'Generate the VAPID Key',
    summary: 'The VAPID key allows the browser to receive push messages.',
    content: [
      {
        type: 'bullets' as const,
        items: [
          'In Firebase Console → Project Settings (gear icon) → Cloud Messaging tab',
          'Scroll to "Web configuration" → "Web Push certificates"',
          'Click "Generate key pair"',
          'Copy the long key string that appears',
        ],
      },
      {
        type: 'table' as const,
        rows: [
          ['What you copied', 'Replit Secret name'],
          ['Key Pair string', 'VITE_FIREBASE_VAPID_KEY'],
        ],
      },
      {
        type: 'warning' as const,
        text: 'Each project has only one VAPID key. If you regenerate it, existing browser subscriptions will stop working and users must re-enable notifications.',
      },
    ],
  },
  {
    id: 'service-account',
    icon: Key,
    color: 'emerald',
    title: 'Create a Service Account for Server Push',
    summary: 'This lets the Supabase edge function send notifications on the server.',
    content: [
      {
        type: 'bullets' as const,
        items: [
          'Firebase Console → Project Settings → Service accounts tab',
          'Click "Generate new private key" → Confirm → a JSON file downloads',
          'Open that JSON file — find three fields inside it',
        ],
      },
      {
        type: 'table' as const,
        rows: [
          ['JSON field', 'Supabase Secret name'],
          ['client_email', 'FIREBASE_CLIENT_EMAIL'],
          ['private_key', 'FIREBASE_PRIVATE_KEY'],
          ['project_id', 'FIREBASE_PROJECT_ID'],
        ],
      },
      {
        type: 'warning' as const,
        text: 'The private_key value contains literal \\n characters. Paste it exactly as-is into the Supabase secret — the edge function handles the conversion automatically.',
      },
      {
        type: 'link' as const,
        label: 'Open Supabase Dashboard → Edge Function Secrets',
        href: 'https://supabase.com/dashboard',
        note: 'Go to your project → Settings → Edge Functions → Secrets',
      },
    ],
  },
  {
    id: 'supabase-table',
    icon: Database,
    color: 'cyan',
    title: 'Create the FCM Tokens Table in Supabase',
    summary: 'A table to store each user\'s device push token.',
    content: [
      {
        type: 'text' as const,
        text: 'Open the Supabase SQL Editor and run this migration:',
      },
      {
        type: 'code' as const,
        lang: 'sql',
        code: `create table if not exists public.user_fcm_tokens (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  token     text not null,
  updated_at timestamptz default now()
);

alter table public.user_fcm_tokens enable row level security;

create policy "Users manage own FCM token"
  on public.user_fcm_tokens
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);`,
      },
      {
        type: 'link' as const,
        label: 'Open Supabase SQL Editor',
        href: 'https://supabase.com/dashboard',
        note: 'Project → SQL Editor → New query → paste the SQL above → Run',
      },
    ],
  },
  {
    id: 'edge-function',
    icon: Terminal,
    color: 'rose',
    title: 'Deploy the check-reminders Edge Function',
    summary: 'This function runs on a cron schedule and fires push notifications for due journal reminders.',
    content: [
      {
        type: 'text' as const,
        text: 'The edge function is already written at supabase/functions/check-reminders/index.ts. Deploy it with:',
      },
      {
        type: 'code' as const,
        lang: 'bash',
        code: `npx supabase functions deploy check-reminders --project-ref YOUR_PROJECT_REF`,
      },
      {
        type: 'text' as const,
        text: 'Then set up a cron job in Supabase to call it every minute:',
      },
      {
        type: 'code' as const,
        lang: 'sql',
        code: `select cron.schedule(
  'check-reminders-every-minute',
  '* * * * *',
  $$
    select net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/check-reminders',
      headers := '{"Authorization":"Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
    )
  $$
);`,
      },
      {
        type: 'warning' as const,
        text: 'Replace YOUR_PROJECT_REF with your Supabase project reference (found in Project Settings → General). YOUR_SERVICE_ROLE_KEY is in Settings → API.',
      },
    ],
  },
  {
    id: 'enable',
    icon: Bell,
    color: 'blue',
    title: 'Enable Notifications in the App',
    summary: 'Last step — grant permission so your browser subscribes.',
    content: [
      {
        type: 'bullets' as const,
        items: [
          'Restart the Replit workflow after adding all the secrets above',
          'Scroll up on this Settings page to the "Push Notifications" card',
          'Click "Enable" — your browser will ask for permission',
          'Click "Allow" in the browser prompt',
          'The button will change to "On · Test" — tap it to send a test notification',
        ],
      },
      {
        type: 'text' as const,
        text: 'To test the full server-push flow (edge function → device), set a journal reminder a minute in the future and wait. You should receive a notification even if the app is in the background.',
      },
      {
        type: 'warning' as const,
        text: 'Notifications require HTTPS. They work on the deployed Replit domain (*.replit.app) but not on localhost in some browsers.',
      },
    ],
  },
];

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; badge: string; badgeText: string }> = {
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-600',  border: 'border-amber-200', badge: 'bg-amber-100',  badgeText: 'text-amber-700'  },
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   border: 'border-blue-200',  badge: 'bg-blue-100',   badgeText: 'text-blue-700'   },
  violet: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200',badge: 'bg-violet-100', badgeText: 'text-violet-700' },
  emerald:{ bg: 'bg-emerald-50',text: 'text-emerald-600',border: 'border-emerald-200',badge:'bg-emerald-100',badgeText: 'text-emerald-700'},
  cyan:   { bg: 'bg-cyan-50',   text: 'text-cyan-600',   border: 'border-cyan-200',  badge: 'bg-cyan-100',   badgeText: 'text-cyan-700'   },
  rose:   { bg: 'bg-rose-50',   text: 'text-rose-600',   border: 'border-rose-200',  badge: 'bg-rose-100',   badgeText: 'text-rose-700'   },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
      title="Copy"
    >
      {copied ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function StepContent({ content }: { content: (typeof STEPS)[0]['content'] }) {
  return (
    <div className="space-y-3">
      {content.map((block, i) => {
        if (block.type === 'text') {
          return (
            <p key={i} className="text-xs text-slate-600 leading-relaxed">{block.text}</p>
          );
        }
        if (block.type === 'bullets') {
          return (
            <ul key={i} className="space-y-1.5">
              {block.items!.map((item, j) => (
                <li key={j} className="flex items-start gap-2 text-xs text-slate-600">
                  <span className="mt-0.5 h-4 w-4 shrink-0 flex items-center justify-center rounded-full bg-slate-100 text-[9px] font-black text-slate-500">{j + 1}</span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === 'table') {
          const [header, ...rows] = block.rows!;
          return (
            <div key={i} className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100">
                    {header.map((h, j) => (
                      <th key={j} className="px-3 py-2 text-left font-bold text-slate-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, j) => (
                    <tr key={j} className="bg-white">
                      <td className="px-3 py-2 font-mono text-slate-700 font-semibold whitespace-nowrap">{row[0]}</td>
                      <td className="px-3 py-2 font-mono text-blue-700 font-bold whitespace-nowrap">{row[1]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.type === 'code') {
          return (
            <div key={i} className="relative">
              <pre className="bg-slate-900 text-slate-100 rounded-xl p-3 pr-10 text-[11px] leading-relaxed font-mono overflow-x-auto whitespace-pre-wrap break-all">
                {block.code}
              </pre>
              <CopyButton text={block.code!} />
            </div>
          );
        }
        if (block.type === 'warning') {
          return (
            <div key={i} className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">{block.text}</p>
            </div>
          );
        }
        if (block.type === 'link') {
          return (
            <div key={i}>
              <a
                href={block.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
              >
                {block.label}
                <ExternalLink className="h-3 w-3" />
              </a>
              {block.note && (
                <p className="text-[11px] text-slate-400 mt-0.5">{block.note}</p>
              )}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

const NotificationSetupGuide: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-blue-50">
            <Bell className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Notification Setup Guide</p>
            <p className="text-xs text-gray-500">Step-by-step: Firebase, VAPID key, service account, Supabase</p>
          </div>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-blue-600 shrink-0" />
          : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
        }
      </button>

      {open && (
        <div className="border-t border-gray-100 p-4 space-y-3">
          <p className="text-xs text-slate-500 leading-relaxed">
            Follow these 7 steps from scratch to get push notifications fully working — including journal reminders delivered to your device even when the app is closed.
          </p>

          {STEPS.map((step, idx) => {
            const c = COLOR_MAP[step.color];
            const isExpanded = expandedStep === step.id;
            const Icon = step.icon;

            return (
              <div
                key={step.id}
                className={`rounded-2xl border transition-all ${isExpanded ? `${c.border} bg-white shadow-sm` : 'border-gray-100 bg-gray-50/50'}`}
              >
                <button
                  onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                  className="w-full flex items-center gap-3 p-3.5 text-left"
                >
                  <div className={`h-7 w-7 shrink-0 rounded-xl flex items-center justify-center text-[11px] font-black ${isExpanded ? `${c.badge} ${c.badgeText}` : 'bg-slate-100 text-slate-500'}`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${isExpanded ? 'text-slate-900' : 'text-slate-700'}`}>{step.title}</p>
                    {!isExpanded && (
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">{step.summary}</p>
                    )}
                  </div>
                  <div className={`p-1.5 rounded-xl shrink-0 ${isExpanded ? `${c.bg} ${c.text}` : 'bg-transparent text-slate-300'}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  {isExpanded
                    ? <ChevronUp className={`h-3.5 w-3.5 shrink-0 ${c.text}`} />
                    : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                  }
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-gray-100">
                    <StepContent content={step.content} />
                  </div>
                )}
              </div>
            );
          })}

          <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">All secrets at a glance</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {[
                'VITE_FIREBASE_API_KEY',
                'VITE_FIREBASE_AUTH_DOMAIN',
                'VITE_FIREBASE_PROJECT_ID',
                'VITE_FIREBASE_STORAGE_BUCKET',
                'VITE_FIREBASE_MESSAGING_SENDER_ID',
                'VITE_FIREBASE_APP_ID',
                'VITE_FIREBASE_VAPID_KEY',
              ].map(s => (
                <div key={s} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                  <code className="text-[11px] font-mono text-slate-600">{s}</code>
                </div>
              ))}
            </div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-3 mb-1.5">Supabase edge function secrets</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {[
                'FIREBASE_CLIENT_EMAIL',
                'FIREBASE_PRIVATE_KEY',
                'FIREBASE_PROJECT_ID',
              ].map(s => (
                <div key={s} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <code className="text-[11px] font-mono text-slate-600">{s}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationSetupGuide;
