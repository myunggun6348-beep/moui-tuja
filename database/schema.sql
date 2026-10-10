-- Dedicated Supabase project. Fictional practice assets only.
begin;
create schema if not exists practice_private;
revoke all on schema practice_private from public, anon, authenticated;
create table public.practice_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 cash bigint not null default 10000000 check (cash >= 0),
 revision integer not null default 0 check (revision between 0 and 1000)
);
create table public.practice_holdings (
 user_id uuid not null references public.practice_accounts(user_id) on delete cascade,
 stock integer not null check (stock between 0 and 2),
 quantity integer not null default 0 check (quantity >= 0),
 average numeric not null default 0 check (average >= 0),
 primary key (user_id, stock)
);
create table public.practice_orders (
 user_id uuid not null references public.practice_accounts(user_id) on delete cascade,
 request_id uuid not null, revision integer not null,
 stock integer not null check (stock between 0 and 2),
 quantity integer not null check (quantity > 0),
 side text not null check (side in ('buy','sell')),
 price bigint not null, fee bigint not null, tax bigint not null, settlement bigint not null,
 created_at timestamptz not null default now(),
 primary key (user_id, request_id), unique (user_id, revision)
);
alter table public.practice_accounts enable row level security;
alter table public.practice_holdings enable row level security;
alter table public.practice_orders enable row level security;
create policy own_account on public.practice_accounts for select to authenticated using ((select auth.uid()) = user_id);
create policy own_holdings on public.practice_holdings for select to authenticated using ((select auth.uid()) = user_id);
create policy own_orders on public.practice_orders for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.practice_accounts, public.practice_holdings, public.practice_orders from anon, authenticated;
grant select on public.practice_accounts, public.practice_holdings, public.practice_orders to authenticated;

create function practice_private.snapshot(p_user uuid) returns jsonb
language sql stable set search_path = '' as $$
 select jsonb_build_object(
   'startingCash',10000000, 'cash',a.cash, 'revision',a.revision,
   'holdings',(select jsonb_agg(jsonb_build_object(
     'name',case h.stock when 0 then '가상 종목 A' when 1 then '가상 종목 B' else '가상 종목 C' end,
     'quantity',h.quantity, 'average',h.average,
     'price',case h.stock when 0 then 85000 when 1 then 315000 else 252000 end) order by h.stock)
     from public.practice_holdings h where h.user_id=p_user),
   'orders',coalesce((select jsonb_agg(jsonb_build_object(
     'id',o.request_id,'index',o.stock,'q',o.quantity,'side',o.side,'at',o.created_at,
     'name',case o.stock when 0 then '가상 종목 A' when 1 then '가상 종목 B' else '가상 종목 C' end,
     'gross',o.price*o.quantity,'fee',o.fee,'tax',o.tax,'settlement',o.settlement) order by o.revision)
     from public.practice_orders o where o.user_id=p_user),'[]'::jsonb)
 ) from public.practice_accounts a where a.user_id=p_user;
$$;
revoke all on function practice_private.snapshot(uuid) from public, anon, authenticated;

create function public.get_practice_account() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
 if u is null then raise exception 'login_required'; end if;
 insert into public.practice_accounts(user_id) values(u) on conflict do nothing;
 insert into public.practice_holdings(user_id,stock) values(u,0),(u,1),(u,2) on conflict do nothing;
 return practice_private.snapshot(u);
end; $$;

create function public.place_practice_order(p_stock integer,p_quantity integer,p_side text,p_revision integer,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 u uuid := auth.uid(); a public.practice_accounts%rowtype; h public.practice_holdings%rowtype;
 prior public.practice_orders%rowtype;
 price bigint; gross bigint; fee bigint; tax bigint; settlement bigint; total numeric;
begin
 if u is null then raise exception 'login_required'; end if;
 if p_stock is null or p_stock not between 0 and 2 or p_quantity is null or p_quantity not between 1 and 1000000
   or p_side is null or p_side not in ('buy','sell') or p_revision is null or p_request_id is null then raise exception 'invalid_order'; end if;
 select * into a from public.practice_accounts where user_id=u for update;
 if not found then raise exception 'login_required'; end if;
 select * into prior from public.practice_orders where user_id=u and request_id=p_request_id;
 if found then
   if prior.stock <> p_stock or prior.quantity <> p_quantity or prior.side <> p_side then raise exception 'request_conflict'; end if;
   return practice_private.snapshot(u);
 end if;
 if a.revision <> p_revision then raise exception 'stale_revision'; end if;
 if a.revision >= 1000 then raise exception 'order_limit'; end if;
 select * into h from public.practice_holdings where user_id=u and stock=p_stock;
 price := case p_stock when 0 then 85000 when 1 then 315000 else 252000 end;
 gross := price * p_quantity; fee := round(gross * 0.00015);
 tax := case when p_side='sell' then round(gross * 0.0018) else 0 end;
 settlement := case when p_side='buy' then gross+fee else gross-fee-tax end;
 if p_side='buy' then
   if settlement > a.cash then raise exception 'insufficient_cash'; end if;
   select a.cash + coalesce(sum(quantity * (case stock when 0 then 85000 when 1 then 315000 else 252000 end)),0)
     into total from public.practice_holdings where user_id=u;
   if (h.quantity + p_quantity) * price > (total-fee) * 0.3 then raise exception 'holding_limit'; end if;
   update public.practice_holdings set average=(average*quantity+gross)/(quantity+p_quantity),quantity=quantity+p_quantity where user_id=u and stock=p_stock;
   update public.practice_accounts set cash=cash-settlement,revision=revision+1 where user_id=u;
 else
   if p_quantity > h.quantity then raise exception 'insufficient_quantity'; end if;
   update public.practice_holdings set average=case when quantity=p_quantity then 0 else average end,quantity=quantity-p_quantity where user_id=u and stock=p_stock;
   update public.practice_accounts set cash=cash+settlement,revision=revision+1 where user_id=u;
 end if;
 insert into public.practice_orders(user_id,request_id,revision,stock,quantity,side,price,fee,tax,settlement)
   values(u,p_request_id,a.revision+1,p_stock,p_quantity,p_side,price,fee,tax,settlement);
 return practice_private.snapshot(u);
end; $$;
revoke all on function public.get_practice_account() from public, anon;
revoke all on function public.place_practice_order(integer,integer,text,integer,uuid) from public, anon;
grant execute on function public.get_practice_account() to authenticated;
grant execute on function public.place_practice_order(integer,integer,text,integer,uuid) to authenticated;
commit;
