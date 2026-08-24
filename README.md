# Ascend

**Your career, elevated.**

Ascend helps high-performing students manage every internship role from analysis to outcome — alignment scoring, skill gap identification, AI-powered resume improvement, and application tracking in one place.

## Features

- **Auth** — Real email/password accounts via Supabase; roles and resume history are private to your account.
- **Analyze a role** — Paste a job description to parse requirements. Add your resume for preparedness scoring, with an AI-generated fit summary.
- **Role breakdown** — Core skills, preferred skills, experience level, and preparation signals.
- **Roles tracker** — Track applications, status, deadlines, and follow-ups — stored in Postgres, synced across devices.
- **Resume Lab** — Rewrite a single bullet, or upload a full resume PDF for an AI critique with prioritized fixes and rewritten bullets, powered by an open-source LLM via Groq.
- **Dashboard** — Performance insights, interview outlook, and recommended actions.

## Tech stack

- React 19 + TypeScript + Vite, Tailwind CSS, Framer Motion, Recharts
- Supabase (Postgres + Auth) for accounts and the roles/resume-history database
- Express backend (`server/`) for PDF parsing and AI calls
- Groq (open-source LLM, default `openai/gpt-oss-120b`) for resume improvement

## Setup

1. **Install dependencies**

   ```bash
   npm install
   cd server && npm install && cd ..
   ```

2. **Create a Supabase project** at [supabase.com](https://supabase.com), then run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor (Dashboard → SQL Editor → New query) to create the `profiles`, `roles`, and `resume_improvements` tables with row-level security.

3. **Get a free Groq API key** at [console.groq.com](https://console.groq.com).

4. **Configure environment variables**

   ```bash
   cp .env.example .env.local
   cp server/.env.example server/.env
   ```

   Fill in `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (root `.env.local`) and `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `GROQ_API_KEY` (`server/.env`) from your Supabase and Groq dashboards.

   Resume Lab and Analyzer's AI features degrade gracefully (fall back to a deterministic/offline result) if `GROQ_API_KEY` isn't set — the app still runs without it.

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Backend

The Express backend (`server/`) handles PDF parsing and Groq AI calls. Run it locally on `http://localhost:5050`:

```bash
cd server
npm run dev
```

Point the frontend at it with `VITE_API_URL=http://localhost:5050` in `.env.local` (already the default in `.env.example`).
