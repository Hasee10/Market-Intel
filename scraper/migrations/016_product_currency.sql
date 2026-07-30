-- seller_products had no currency column at all - every price was assumed
-- PKR with no way for a seller in a different market to say otherwise.
-- Apply manually against Supabase, same convention as 001-015.

alter table seller_products add column if not exists currency text not null default 'PKR';
