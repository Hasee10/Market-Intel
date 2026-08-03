-- Closes the unauthenticated referral plan-tier escalation documented in
-- leaks.md finding #1.
--
-- The old flow had the signup page POST {referralCode, userId} to
-- /api/referrals/record, which looked the seller up with the *service-role*
-- client and granted the free->paid reward. That endpoint could not be
-- session-gated (there is no session at signup while email confirmation is
-- pending), so any unauthenticated caller could replay it with their own
-- code until they crossed the 3-join reward threshold and unlocked every
-- paid feature.
--
-- The fix is to stop having an endpoint at all: the referral code now rides
-- along in auth.signUp()'s options.data, and this trigger - which already
-- runs security-definer to provision the sellers row - records the referral
-- and applies the reward. There is no longer any attacker-reachable surface,
-- because the only way to submit a code is to actually create an auth user.
--
-- Apply manually against Supabase, same convention as 001-017.

-- A seller can only ever be counted as referred once. Without this, the old
-- endpoint could be replayed against the same joined_seller_id to inflate a
-- referrer's count; it also protects the new path against a retried signup.
create unique index if not exists seller_referrals_joined_seller_uniq
  on seller_referrals (joined_seller_id)
  where joined_seller_id is not null;

-- Reward threshold lives here rather than in TypeScript, because this is now
-- the only writer. lib/market-intel/referrals.ts re-declares it for display
-- purposes only ("N of 3 joined") - this value is authoritative.
create or replace function public.handle_new_seller_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reward_joins_for_paid constant integer := 3;
  new_seller_id uuid;
  submitted_code text;
  referrer_id uuid;
  referrer_tier text;
  joined_total integer;
begin
  insert into public.sellers (user_id, business_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'business_name', 'My Store'),
    new.email
  )
  on conflict (user_id) do nothing
  returning id into new_seller_id;

  -- Conflict means this auth user already had a seller row; nothing to
  -- provision and no referral to record.
  if new_seller_id is null then
    return new;
  end if;

  submitted_code := nullif(trim(new.raw_user_meta_data ->> 'referral_code'), '');
  if submitted_code is null then
    return new;
  end if;

  -- Referral handling is best-effort and must never break signup: this
  -- trigger runs inside the auth.users insert transaction, so an exception
  -- escaping here would fail account creation outright. A lost referral is
  -- recoverable; a failed signup is not.
  begin
    select id, plan_tier
      into referrer_id, referrer_tier
      from public.sellers
     where referral_code = submitted_code;

    if referrer_id is null or referrer_id = new_seller_id then
      return new;
    end if;

    insert into public.seller_referrals
      (referrer_seller_id, referral_code, status, joined_seller_id, joined_at)
    values
      (referrer_id, submitted_code, 'joined', new_seller_id, now())
    on conflict do nothing;

    select count(*)
      into joined_total
      from public.seller_referrals
     where referrer_seller_id = referrer_id
       and status = 'joined';

    if joined_total >= reward_joins_for_paid and referrer_tier = 'free' then
      update public.sellers set plan_tier = 'paid' where id = referrer_id;
    end if;
  exception
    when others then
      raise warning 'referral recording failed for code %: %', submitted_code, sqlerrm;
  end;

  return new;
end;
$$;

-- Trigger definition itself is unchanged from 013; recreated here so this
-- migration is self-contained if 013 was applied before the function was
-- extended.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_seller_signup();
