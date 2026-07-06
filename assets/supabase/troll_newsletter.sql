-- ============================================================================
-- TROLLRUNNER NEWSLETTER SIGNUPS — "coming soon" gate email capture.
-- Run ONCE in Supabase -> SQL Editor. Idempotent -- safe to re-run.
--
-- Anyone can INSERT their email (public signup form). Nobody but a real
-- admin (see troll_admin_lockdown.sql for troll_is_admin()) can read the
-- list back out -- this keeps the anon key from being usable to scrape
-- subscriber emails.
-- ============================================================================

create table if not exists public.newsletter_signups (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists newsletter_signups_email_key
  on public.newsletter_signups (lower(email));

alter table public.newsletter_signups enable row level security;

drop policy if exists newsletter_signups_admin_read on public.newsletter_signups;
create policy newsletter_signups_admin_read on public.newsletter_signups
  for select to authenticated using (troll_is_admin());

revoke all on public.newsletter_signups from anon, authenticated;
grant select on public.newsletter_signups to authenticated;

-- Anon-callable, scoped: only inserts a validated email, nothing else.
create or replace function public.troll_submit_newsletter_signup(
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'Enter a valid email address.';
  end if;

  insert into public.newsletter_signups (email) values (v_email)
    on conflict (lower(email)) do nothing;

  return jsonb_build_object('saved', true);
end;
$$;

revoke all on function public.troll_submit_newsletter_signup(text) from public;
grant execute on function public.troll_submit_newsletter_signup(text) to anon, authenticated;
