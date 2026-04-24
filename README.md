# ResumeForge

AI-powered resume builder for creating, refining, and tailoring resumes with Gemini or Groq.

## What It Does

- Build and manage multiple resume profiles from a local JSON database.
- Normal users can create up to 4 profiles.
- Admins can see every profile in the profile dropdown, with the owner name shown alongside each entry.
- Upload a resume in PDF or DOCX format and auto-fill the form with parsed data.
- Generate ATS-friendly summary text, experience bullets, and project descriptions with AI.
- Tailor a resume to a specific job description with a match score, skill suggestions, rewritten bullets, a LinkedIn message, and a formal application email.
- If you are logged in as an admin, manage users from the `Users` tab with create, edit, activate/inactivate, password change, and delete actions.
- In the Users modal, the username mirrors the email value and role is saved automatically in the API.
- The Users screen uses a shared modal and switches to stacked mobile cards on smaller screens.
- In JD Tailoring, you can fetch a public job description from a URL and the app stores that fetched text temporarily in `db.json` until you leave the tab or it expires.
- JD tailoring appends only new skills into `Others` in the downloaded PDF instead of adding a separate `JD-Matched Skills` block.
- Choose an accent color and download a styled PDF resume from multiple templates.

## Tech Stack

- React 19
- TypeScript
- Vite 6
- Tailwind CSS v4
- React Router v7
- json-server
- Google Gemini API
- Groq API
- jsPDF and html2canvas
- pdfjs-dist and mammoth
- lucide-react

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root:

```bash
VITE_GEMINI_API_KEY=your_gemini_key
VITE_GROQ_API_KEY=your_groq_key
```

3. Start the app:

```bash
npm run dev
```

The app runs on `http://localhost:5173` and the local API runs on `http://localhost:3001`.

## Scripts

```bash
npm run dev        # Vite + json-server together
npm run server     # json-server only
npm run build      # TypeScript build + Vite production build
npm run preview    # Preview the production build
npm run type-check # TypeScript check only
```

## Login

- Username: `ankit`
- Password: `ankit123`
- Admin users see an additional `Users` tab after sign-in.
- In the profile dropdown, admins can browse profiles created by other users.

## AI Workflow

- Gemini is the default provider.
- Groq is available as an alternative provider.
- Gemini uses model fallback in this order: `gemini-2.5-flash`, `gemini-2.0-flash-lite`, `gemini-1.5-flash-8b`.
- Groq uses `llama-3.3-70b-versatile` by default and `llama-3.1-8b-instant` as the lighter option.
- You can toggle Gemini auto-fallback in the UI.

## Project Structure

```text
src/
  components/        reusable UI pieces such as AI suggestion cards and toasts
  context/           auth and profile state
  pages/             login, profile builder, and JD tailoring screens
  utils/             AI calls, PDF generation, and file parsing
  types.ts           shared TypeScript types
  index.css          Tailwind v4 styles and reusable component classes
db.json              local data store for users and profiles
```

## Data And Storage

- Resume data is stored locally in `db.json`.
- The browser does not read `db.json` directly.
- Only the text you send to Gemini or Groq leaves the local app.

## Notes

- The profile builder supports multiple profiles.
- Non-admin users are limited to 4 profiles.
- Resume upload accepts PDF and DOCX files.
- Job description tailoring only works after a profile has personal info and at least one experience entry.
- Admin accounts cannot be deleted or inactivated by other admins.
