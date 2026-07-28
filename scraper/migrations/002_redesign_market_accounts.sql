-- market_accounts (created in 001) was a thin user_id/role placeholder with
-- no rows yet. Redesign it to be self-contained (own email + password_hash),
-- mirroring bordful-main's recruiter_accounts pattern, so the Phase 2
-- market_analyst credentials login has something real to authenticate against.

alter table market_accounts drop column if exists user_id;
alter table market_accounts drop column if exists role;

alter table market_accounts add column if not exists email text;
alter table market_accounts add column if not exists password_hash text;
alter table market_accounts add column if not exists company_name text;
alter table market_accounts add column if not exists plan_tier text not null default 'free';
alter table market_accounts add column if not exists updated_at timestamptz not null default now();

update market_accounts set email = '' where email is null;
update market_accounts set password_hash = '' where password_hash is null;
update market_accounts set company_name = '' where company_name is null;

alter table market_accounts alter column email set not null;
alter table market_accounts alter column password_hash set not null;
alter table market_accounts alter column company_name set not null;

create unique index if not exists market_accounts_email_idx on market_accounts (lower(email));
