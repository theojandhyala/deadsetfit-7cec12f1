-- Harden duels after review (applied to live DB via Lovable 2026-07-22):
--  * final-score columns so completed duels don't re-score every read
--  * revoke direct UPDATE so participants can't PATCH rows to cheat scores/window
--  * one open duel per unordered pair (prevents the create race + permanent lock)
alter table public.duels add column if not exists challenger_score numeric;
alter table public.duels add column if not exists opponent_score numeric;
alter table public.duels add column if not exists winner_id uuid;

revoke update on public.duels from authenticated;
drop policy if exists "duel participants update" on public.duels;

create unique index if not exists duels_open_pair
  on public.duels (least(challenger_id, opponent_id), greatest(challenger_id, opponent_id))
  where status in ('pending','active');
