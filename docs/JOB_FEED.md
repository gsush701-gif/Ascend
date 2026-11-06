# Job feed (company boards)

Ascend's `/jobs` page searches internship and new-grad postings copied daily from
companies' own public career boards. Nothing is scraped from LinkedIn, Indeed or
any site that forbids it, and the student always applies on the company's own
posting page.

## How it works

1. `.github/workflows/sync-jobs.yml` calls `POST /api/cron/sync-jobs` every day at
   09:00 UTC (and on demand from the Actions tab). The endpoint is protected by
   `CRON_SECRET`, answers 202 at once, and runs the sync in the background.
2. `server/lib/jobBoards/sync.js` reads each company in `server/data/jobBoards.json`
   from its public board: Greenhouse, Lever or Ashby (adapters in `feeds.js`).
3. Only early-career postings are kept (`earlyCareer.js`): titles with intern,
   internship or co-op, and new-grad, university-grad, early-career or entry-level.
   Senior titles and words like "Internal" or "International" are excluded.
4. Kept postings are saved into the shared `jobs` table (`store.js`). A posting that
   has left its board is marked `active = false`.
5. `server/lib/jobProviders/boardsProvider.js` searches that table, so a student's
   search never calls a company's board live. `GET /api/jobs/recommendations` scores
   the open postings against the student's resume with the existing matcher.

Safety rules in the sync: a board that fails to load is skipped and nothing is
closed for it; postings are only closed when the board returned a non-empty
listing; a Greenhouse posting is only downloaded in full when it is new or edited.

## First run

1. Run `supabase/migrations/028_job_boards.sql` in the Supabase SQL editor (before
   deploying the code that uses it).
2. Deploy.
3. GitHub, Actions tab, "Sync job feed", Run workflow. It needs the repository secrets
   `ASCEND_API_URL` and `CRON_SECRET` (the same ones the weekly report workflow uses).
   The first run takes under a minute.
4. Check the Admin page, "Job feed" panel, and `/jobs`.

## Adding a company

Add an entry to `server/data/jobBoards.json`:

```json
{ "name": "Company Name", "ats": "greenhouse", "token": "companytoken" }
```

The token is the last part of the company's jobs page address
(`boards.greenhouse.io/<token>`, `jobs.lever.co/<token>`, `jobs.ashbyhq.com/<token>`).
Check it first by opening the public address in a browser:

- Greenhouse: `https://boards-api.greenhouse.io/v1/boards/<token>/jobs`
- Lever: `https://api.lever.co/v0/postings/<token>?mode=json`
- Ashby: `https://api.ashbyhq.com/posting-api/job-board/<token>`

Use the company's everyday name; it is always the name shown, because the boards' own
company names are sometimes legal names ("Gusto, Inc.") or wrong ("Rubrik Job Board").
A wrong name would put a posting under the wrong company, so check it.

## Limits

- Postings first published more than a year ago are left out, because some boards leave old postings open for years.
- Only companies on these three systems, and only those in the list. Employers on
  Workday, Taleo and similar are not covered.
- No salary or visa-sponsorship data comes from these boards, so those filters are
  not applied to this feed.
- Supabase returns at most 1,000 rows per query, so recommendations score the 1,000
  newest open postings.
- The vendors' public APIs state no rate limit and no third-party terms. Keep the
  daily schedule polite, always link back to the original posting, and revisit this
  if a vendor publishes terms.
