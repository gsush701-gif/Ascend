# Ascend

**Your career, elevated.**

Ascend helps high-performing students manage every internship role from analysis to outcome — alignment scoring, skill gap identification, resume improvement, and application tracking in one place.

## Features

- **Analyze a role** — Paste a job description to parse requirements. Add your resume for preparedness scoring.
- **Role breakdown** — Core skills, preferred skills, experience level, and preparation signals.
- **Action panel** — Tailor resume bullets, add skill notes, mark next steps.
- **Roles tracker** — Track applications, status, deadlines, and follow-ups.
- **Resume Lab** — Upgrade bullets with clarity, metrics, and technical depth.
- **Dashboard** — Performance insights, interview outlook, and recommended actions.

## Tech stack

- React 19 + TypeScript + Vite
- Tailwind CSS
- Framer Motion
- Recharts

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Analyzer backend

For full alignment analysis (resume + JD), run the backend on `http://localhost:5050`:

```bash
# From the backend repo
npm run dev
```

Without the backend, you can still use JD-only parsing to extract role requirements from job descriptions.
