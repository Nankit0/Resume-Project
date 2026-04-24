# ResumeForge - Claude Notes

Use this file as the quick onboarding guide for the repository.

## What To Know First

- This is a resume builder with Supabase auth and storage, and AI-assisted resume writing.
- The app has two main user flows: building a profile and tailoring that profile to a job description.
- Auth (login, user records) and profile data both go through Supabase. `src/services/profileService.ts` handles all profile CRUD against the Supabase `profiles` table. json-server / db.json is only used by `UsersTab.tsx` for user management CRUD.
- The app supports multiple profiles for the same user.
- Admin users see a third tab for managing users.
- Non-admin users are limited to 4 profiles.
- Admins can browse all profiles and see the owner label in the profile dropdown.
- `ProfileTab.tsx` includes an ATS scoring flow: users can evaluate their profile against ATS criteria and auto-apply suggested improvements.

## Main Entry Points

- `src/App.tsx` wires the router.
- `src/pages/Login.tsx` handles sign-in.
- `src/pages/AppLayout.tsx` contains the main tab shell and admin-only `Users` tab.
- `src/pages/ProfileTab.tsx` manages profile editing, resume upload, AI suggestions, and PDF template selection.
- `src/pages/JDTab.tsx` handles JD analysis, tailored output, copy actions, and PDF export.
- `src/pages/JDTab.tsx` appends only missing JD skills into `Others` when exporting tailored PDFs.
- `src/pages/JDTab.tsx` can fetch a public job description from a URL, cache it temporarily in `db.json`, and clear it on tab close or timeout.
- `src/pages/UsersTab.tsx` handles user CRUD, active/inactive state, and password updates.
- `src/pages/UsersTab.tsx` uses shared helpers for form fields, status pills, and action buttons, and switches between table and card layouts responsively.
- `src/context/ProfileContext.tsx` owns profile loading, creation limits, and owner metadata for admin dropdowns.
- The Users modal keeps username aligned with email and hides role selection.

## AI Helper Files

- `src/utils/ai.ts` contains all Gemini and Groq calls, including ATS evaluation and auto-fix.
- `src/utils/fileParser.ts` extracts text from PDF and DOCX files.
- `src/utils/pdfGenerator.ts` exports five resume templates: Classic, ATS-optimized, Modern (two-column), Skills-First, and Executive.
- `src/utils/jdUrlFetcher.ts` fetches and clears public JD content via the `/api/jd/fetch` middleware endpoint.

## Commands

```bash
npm install
npm run dev
npm run server
npm run build
npm run type-check
```

## Environment

```bash
VITE_GEMINI_API_KEY=your_gemini_key
VITE_GROQ_API_KEY=your_groq_key
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Supabase credentials are required for auth. Without them login will fail silently.

## AI Behavior

- Gemini is the default provider.
- Gemini models fallback in this order: `gemini-2.5-flash`, `gemini-2.0-flash-lite`, `gemini-1.5-flash-8b`.
- Groq models are `llama-3.3-70b-versatile` and `llama-3.1-8b-instant`.
- Gemini retries 429 and 503 responses with retry delays from the API when present.
- Groq has no retry or fallback layer.

## When Editing

- Keep the README, AGENTS, and CLAUDE docs in sync when the workflow changes.
- Auth and profile storage are both Supabase. `src/services/profileService.ts` is the single layer for profile reads/writes — do not add direct fetch calls to json-server for profiles.
- If you change any AI function signatures or output shapes, update `src/utils/ai.ts`, `src/types.ts`, and the docs together.
- Keep responsive behavior in mind when editing shell, modal, and table layouts.
- Keep the Users form source-of-truth simple: email drives username, while role stays API-managed.
- Keep profile ownership intact when admins view or save profiles created by other users.
- When adding new optional Profile fields, update all five PDF template generators in `src/utils/pdfGenerator.ts` if the field should appear in output.
