-- Auto-provision a `sellers` row whenever someone signs up via Supabase
-- Auth, so the app never has to do a separate "create tenant" API call
-- after auth.signUp() - the row just exists by the time the session comes
-- back. business_name is read from the signup call's options.data (see
-- supabase.auth.signUp({ options: { data: { business_name } } }) in the
-- Next.js signup page) and falls back to a placeholder if omitted.
-- Apply manually against Supabase, same convention as 001-012.

create or replace function public.handle_new_seller_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sellers (user_id, business_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'business_name', 'My Store'),
    new.email
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_seller_signup();
