# ResumeForge - Agent Guide

This document is for agents working in this repository. Keep it aligned with the codebase, prefer local facts over memory, and update it when the app surface changes.

## Repository Snapshot

- ResumeForge is a multi-profile resume builder.
- The UI has three tabs for admins: `Profile Builder`, `JD Tailoring`, and `Users`.
- Non-admin users only see `Profile Builder` and `JD Tailoring`.
- Non-admin users can create at most 4 profiles.
- Admins can see all profiles in the profile dropdown, with owner labels shown in the UI.
- Auth (login, user records) is handled by **Supabase** — not json-server.
- Profile data lives in `db.json` through `json-server` on port `3001`.
- The frontend runs on Vite on port `5173`.
- Resume upload supports PDF and DOCX parsing.
- AI content generation supports Gemini and Groq.
- ProfileTab includes an ATS scoring loop: evaluate score → view improvements → auto-apply fixes.

## Useful Commands

```bash
npm install
npm run dev
npm run server
npm run build
npm run preview
npm run type-check
```

## Current App Flow

- `src/pages/Login.tsx` handles local login.
- `src/pages/AppLayout.tsx` switches between the profile, JD, and admin users tabs.
- `src/pages/ProfileTab.tsx` handles profile editing, resume upload, AI generation, ATS scoring/auto-fix, profile switching, and PDF template selection.
- `src/pages/ProfileTab.tsx` enforces the 4-profile cap for non-admins and shows owner names for admin profile browsing.
- `src/pages/JDTab.tsx` handles JD analysis, match scoring, copy actions, and tailored PDF export.
- `src/pages/JDTab.tsx` appends only missing JD skills into `Others` without mutating the base skill categories.
- `src/pages/JDTab.tsx` can fetch a public JD from a URL through the Vite dev/preview middleware, and the temporary cache is cleaned up on tab close or expiry.
- `src/pages/UsersTab.tsx` handles admin user CRUD, status toggling, and password changes.
- The Users modal keeps `username` synced to `email` and does not expose role editing.
- The Users list is reusable across desktop and mobile layouts, with table rows on large screens and card views on small screens.
- `src/context/AuthContext.tsx` manages Supabase auth state.
- `src/utils/fileParser.ts` extracts text from PDF and DOCX files before parsing.
- `src/utils/pdfGenerator.ts` exports five PDF templates: Classic, ATS-optimized, Modern (two-column sidebar), Skills-First (skills at top), and Executive (Harvard-style).
- `src/utils/jdUrlFetcher.ts` exports `fetchJdFromUrl(url)` and `clearFetchedJd(id)` for the JD URL cache flow.

## AI Surface

All exported AI helpers in `src/utils/ai.ts` follow this pattern:

```ts
function(
  ...inputs,
  provider: AIProvider = 'gemini',
  model?: GeminiModel | GroqModel,
  allowFallback = true,
): Promise<string>
```

### Providers

| Provider | Env var | Base URL |
|----------|---------|----------|
| `gemini` | `VITE_GEMINI_API_KEY` | `https://generativelanguage.googleapis.com/v1beta/models` |
| `groq` | `VITE_GROQ_API_KEY` | `https://api.groq.com/openai/v1/chat/completions` |

Supabase auth requires two additional env vars (not AI-related):

| Purpose | Env var |
|---------|---------|
| Auth URL | `VITE_SUPABASE_URL` |
| Auth key | `VITE_SUPABASE_ANON_KEY` |

### Models

| Provider | Models |
|----------|--------|
| Gemini | `gemini-2.5-flash`, `gemini-2.0-flash-lite`, `gemini-1.5-flash-8b` |
| Groq | `llama-3.3-70b-versatile`, `llama-3.1-8b-instant` |

### Behavior

- Gemini retries 429 and 503 responses once per model.
- Gemini uses `retryDelay` from the error body when it is available.
- Gemini falls back across the configured model list when `allowFallback` is enabled.
- Groq makes a single request and throws on failure.
- Groq throws immediately when the API key is missing.

### Exported Functions

- `generateAbout(rawNotes, profile, provider?, model?, allowFallback?)`
- `generateExperienceBullets(role, company, rawNotes, provider?, model?, allowFallback?)`
- `generateProjectDesc(projectName, techStack, rawNotes, provider?, model?, allowFallback?)`
- `parseResumeToProfile(resumeText, provider?, model?, allowFallback?)`
- `analyzeJD(jdText, profile, provider?, model?, allowFallback?)`
- `evaluateATSScore(profile, provider?, model?, allowFallback?)`
- `fixProfileForATS(profile, improvements[], provider?, model?, allowFallback?)`

### Output Contracts

- `generateAbout` returns plain summary text.
- `generateExperienceBullets` returns a JSON array string.
- `generateProjectDesc` returns a JSON object string with `description` and `impact`.
- `parseResumeToProfile` returns a full profile JSON string for drafts.
- `analyzeJD` returns the `JDAnalysisResult` JSON string from `src/types.ts`.
- `evaluateATSScore` returns an `ATSResult` object with `score` (0–100), `strengths[]`, and `improvements[]`.
- `fixProfileForATS` returns a `Partial<Profile>` with suggested field updates applied.

## Data Model Notes

- `User.userRole` is either `admin` or `user`.
- `User.isActive` controls whether the account can log in.
- New users default to `userRole: 'user'`; the form does not expose role selection.
- `Profile.personal` stores contact details.
- `ProfileListItem` is the enriched profile shape used by the dropdown and includes owner labels for admins.
- `Profile.experience[].bullets` is an array of bullet strings.
- `Profile.projects[]` includes `description` and `impact`.
- `Profile.skills` is a category-to-string map.
- `Profile.skillRatings` is optional and only affects the PDF.
- `Profile.interests` is an optional `string[]` for professional/technical interests.
- `Profile.personalDetails` is an optional `string[]` for personal info (e.g. D.O.B., nationality).
- `Profile.keyAchievements` is an optional `string[]` for a dedicated achievements section.
- `Profile.sectionTitles` is an optional `Record<string, string>` for customising section headings in PDFs.
- Admin users cannot be deleted or inactivated from the Users tab.

## Editing Notes

- Keep docs ASCII unless a Unicode character is already required elsewhere.
- Prefer `apply_patch` for manual file edits.
- Do not revert unrelated user changes.
- If AI behavior changes in `src/utils/ai.ts`, update this file and `README.md` together.
