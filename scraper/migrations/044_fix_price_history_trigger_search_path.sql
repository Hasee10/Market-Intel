-- Fixes a real gap found in a code audit (2026-08-29): every SECURITY
-- DEFINER function is supposed to pin `search_path` (013's
-- handle_new_seller_signup and 018's replacement both do), since a
-- DEFINER function with a mutable search path is the classic Postgres
-- privilege-escalation shape and is flagged by Supabase's own linter.
-- record_seller_product_price_history (030) was the one exception - no
-- search_path set, and its insert target unqualified. Same fix as the other
-- two: pin search_path and schema-qualify the table it writes to.
--
-- `create or replace function` is safe here (unlike 040's scorecards fix) -
-- this function's signature and return type are unchanged, only its body,
-- so no drop-first step is needed.
--
-- Apply manually via the Supabase SQL Editor, after 030.

create or replace function record_seller_product_price_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') or (new.sell_price is distinct from old.sell_price) then
    insert into public.seller_product_price_history (seller_product_id, seller_id, sell_price)
    values (new.id, new.seller_id, new.sell_price);
  end if;
  return new;
end;
$$;
