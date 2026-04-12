# AI Rules

## Tech Stack

- **React 18 + TypeScript** powers the app UI, with all application code living under `src/`.
- **Vite** is the build tool and dev server for the project.
- **React Router v6** handles navigation, and route definitions live in `src/App.tsx`.
- **Tailwind CSS** is the primary styling system, imported through `src/index.css`.
- **Supabase (`@supabase/supabase-js`)** is used for authentication, database access, and storage via `src/lib/supabaseClient.ts`.
- **lucide-react** is the icon library for UI icons.
- **date-fns** is the library for date formatting and date calculations.
- **jsPDF + jspdf-autotable** are used for PDF creation and printable/exported documents.
- The codebase is organized mainly by feature under `src/components/`, with shared types in `src/types/` and utilities in `src/utils/`.

## Library Usage Rules

- Use **React + TypeScript** for all new UI and logic files. Do not add plain JavaScript files for app code.
- Use **React Router** for navigation changes, and keep route setup centralized in `src/App.tsx`.
- Use **Tailwind CSS** for styling. Prefer utility classes in components over adding new custom CSS unless the style is truly global.
- Use **`src/index.css`** only for global styles, Tailwind layers, resets, and cross-app utility classes.
- Use **Supabase** for auth, database queries, and file storage. Reuse the existing client from `src/lib/supabaseClient.ts` instead of creating new clients.
- Use **lucide-react** for icons. Do not introduce another icon library unless explicitly required.
- Use **date-fns** for parsing, formatting, and comparing dates. Do not hand-roll date formatting helpers.
- Use **jsPDF** and **jspdf-autotable** only for PDF/export features. Do not introduce a second PDF library.
- Prefer **existing feature components** and established patterns in `src/components/` before creating new abstractions.
- If a reusable UI primitive is needed, prefer the project's available **shadcn/ui** components before introducing a new UI library.
- Do not add overlapping libraries for problems already covered by the current stack.

## Implementation Conventions

- Keep new pages and routed screens connected through `src/App.tsx`.
- Keep feature-specific UI close to its feature folder under `src/components/`.
- Put shared utility logic in `src/utils/` and shared types in `src/types/`.
- Keep changes focused and consistent with current app patterns rather than introducing a parallel architecture.
