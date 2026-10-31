-- Generic rate limiter for the handful of intentionally-public,
-- unauthenticated endpoints that have no other abuse protection:
-- password-reset-requests.js's `submit`, track-click.js's `track`, and
-- gallery-export.js's code lookup. Same atomic increment-and-check shape
-- as consume_anon_ai_call() (20260807120000_ai_usage_cap.sql), generalized
-- to a (bucket, time window) counter instead of one hardcoded daily row,
-- so one function serves all three call sites with their own window/limit.
--
-- Fixed-window counting (not sliding/token-bucket) — simple, and good
-- enough for "bound the worst case," not precise fairness. A denied call
-- still increments, same reasoning as the AI cap: someone hammering an
-- endpoint stays blocked for the rest of the window rather than getting a
-- fresh allowance on every retry.
create table rate_limits (
  bucket_key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (bucket_key, window_start)
);

alter table rate_limits enable row level security;
-- No policies on purpose — same posture as ai_usage_daily: only the
-- serverless functions touch this, via the service-role key, which
-- bypasses RLS. No client can read or write it directly.

create or replace function public.consume_rate_limit(p_bucket text, p_window_seconds int, p_limit int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_window_start timestamptz;
  v_count int;
begin
  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into rate_limits (bucket_key, window_start, count) values (p_bucket, v_window_start, 1)
    on conflict (bucket_key, window_start) do update set count = rate_limits.count + 1
    returning count into v_count;

  -- Opportunistic cleanup rather than a separate cron — bounded cost (one
  -- delete per call, keyed by the indexed window_start), and this table
  -- only exists to answer "has this bucket gone over its limit recently,"
  -- so nothing is lost by sweeping anything more than a day old.
  delete from rate_limits where window_start < now() - interval '1 day';

  return v_count <= p_limit;
end;
$$;

-- Callable only by the service role, same reasoning as consume_anon_ai_call:
-- without this revoke, Postgres grants execute to PUBLIC by default, and a
-- browser client could call it directly to probe or reset counters.
revoke execute on function public.consume_rate_limit(text, int, int) from public;
revoke execute on function public.consume_rate_limit(text, int, int) from anon;
revoke execute on function public.consume_rate_limit(text, int, int) from authenticated;
