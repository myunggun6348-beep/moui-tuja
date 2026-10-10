-- Additive migration: account balances, holdings and orders are unchanged.
begin;
create table if not exists public.practice_watchlist (
 user_id uuid not null references auth.users(id) on delete cascade,
 stock integer not null check (stock between 0 and 2),
 primary key (user_id, stock)
);
alter table public.practice_watchlist enable row level security;
revoke all on public.practice_watchlist from public, anon, authenticated;
grant select, insert, delete on public.practice_watchlist to authenticated;
drop policy if exists watchlist_select on public.practice_watchlist;
drop policy if exists watchlist_insert on public.practice_watchlist;
drop policy if exists watchlist_delete on public.practice_watchlist;
create policy watchlist_select on public.practice_watchlist for select to authenticated using (user_id = auth.uid());
create policy watchlist_insert on public.practice_watchlist for insert to authenticated with check (user_id = auth.uid());
create policy watchlist_delete on public.practice_watchlist for delete to authenticated using (user_id = auth.uid());
commit;
