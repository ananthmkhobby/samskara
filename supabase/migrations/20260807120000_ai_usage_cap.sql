-- Anonymous demo visitors can use the AI features (voice interview,
-- translation, photo scan) without signing in — that's deliberate, it's the
-- headline of the public demo. But the OpenAI key behind those endpoints is
-- the operator's, so unauthenticated use needs a hard ceiling or anyone who
-- finds the URL has a free API key on someone else's bill.
--
-- Signed-in family members are unaffected (no cap); this counter only ever
-- moves for requests that arrive with no valid session.
create table ai_usage_daily (
  usage_date date primary key default current_date,
  anon_calls int not null default 0
);

alter table ai_usage_daily enable row level security;
-- No policies on purpose: only the serverless functions touch this, and they
-- use the service-role key, which bypasses RLS. No client can read or write it.

-- Atomic increment-and-check in one statement, so two simultaneous requests
-- can't both slip past the limit by reading a stale count. Denied calls still
-- increment, which is what we want — someone hammering it stays blocked
-- rather than getting a fresh allowance each time they retry.
create or replace function public.consume_anon_ai_call(p_limit int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  insert into ai_usage_daily (usage_date, anon_calls) values (current_date, 1)
    on conflict (usage_date) do update set anon_calls = ai_usage_daily.anon_calls + 1
    returning anon_calls into v_count;
  return v_count <= p_limit;
end;
$$;

-- Callable only by the service role (i.e. the serverless functions). Without
-- this revoke, Postgres grants execute to PUBLIC by default and a browser
-- client could burn the day's quota by calling it in a loop.
revoke execute on function public.consume_anon_ai_call(int) from public;
revoke execute on function public.consume_anon_ai_call(int) from anon;
revoke execute on function public.consume_anon_ai_call(int) from authenticated;
