-- Company-board job feed (see server/lib/jobBoards and docs/CAREER_MUSE_DESIGN.md).
--
-- A daily sync copies internship and new-grad postings from companies' own
-- public boards (Greenhouse, Lever, Ashby) into the shared `jobs` table. These
-- columns let the sync recognise a posting it has already saved, notice when a
-- company edits one, and close postings that have left the board.
--
--   external_id        "<board token>:<posting id>", unique per source
--   board_token        which company board it came from
--   active             false once the posting has left the board
--   last_seen_at       the last sync run that saw it on the board
--   source_updated_at  the board's own "updated" marker (Greenhouse), so an
--                      unchanged posting is not downloaded again
--
-- Additive only; existing rows keep working (active defaults to true, the new
-- columns are null). `jobs` keeps RLS enabled with no policies, so only the
-- backend's service-role client reads or writes it.

alter table jobs
  add column if not exists external_id text,
  add column if not exists board_token text,
  add column if not exists active boolean not null default true,
  add column if not exists last_seen_at timestamptz,
  add column if not exists source_updated_at text;

-- Plain (not partial) so the sync's upsert can use it as its conflict target.
-- Rows with a null external_id (anything not from a board) never collide.
create unique index if not exists jobs_source_external_idx on jobs(source, external_id);

create index if not exists jobs_active_posted_idx on jobs(active, posted_at desc nulls last);
create index if not exists jobs_board_idx on jobs(source, board_token);
