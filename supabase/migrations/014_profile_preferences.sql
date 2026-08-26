-- Work authorization / location preference fields on `profiles` (Phase 5,
-- Task 3), additive-only per this repo's migration convention. Used to
-- render an honest, purely-textual compatibility comparison against a
-- role's own sponsorship/location/remote_type fields (added in Phase 2b) —
-- never a fabricated numeric "match score", and never immigration/legal
-- advice, just pattern-matching on employer-stated info vs. user preference.
alter table profiles
  add column if not exists work_authorization text,
  add column if not exists requires_sponsorship boolean,
  add column if not exists preferred_locations text,
  add column if not exists remote_preference text;
