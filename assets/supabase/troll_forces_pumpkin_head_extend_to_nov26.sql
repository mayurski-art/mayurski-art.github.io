-- Troll Forces: extend the Pumpkin Head claim window through Chapter One,
-- November 26, 2026 (Pacific time). Apply this in the Supabase SQL editor
-- so the already-deployed grant function uses the new end date.
-- Existing grants are untouched; this only extends the claim window.

create or replace function public.troll_forces_claim_pumpkin_head()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_from  timestamptz := timestamptz '2026-10-26 00:00:00 America/Los_Angeles';
  v_until timestamptz := timestamptz '2026-11-27 00:00:00 America/Los_Angeles';
  v_at    timestamptz;
begin
  if v_uid is null then
    return json_build_object('owned', false, 'open', now() >= v_from and now() < v_until);
  end if;
  if now() >= v_from and now() < v_until then
    insert into troll_forces_grants (user_id, item, source)
    values (v_uid, 'pumpkin-head', 'login')
    on conflict (user_id, item) do nothing;
  end if;
  select granted_at into v_at from troll_forces_grants where user_id = v_uid and item = 'pumpkin-head';
  return json_build_object('owned', v_at is not null, 'granted_at', v_at, 'open', now() >= v_from and now() < v_until);
end;
$$;

revoke all on function public.troll_forces_claim_pumpkin_head() from public;
grant execute on function public.troll_forces_claim_pumpkin_head() to authenticated;
