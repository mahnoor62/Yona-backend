-- =============================================================================
-- Bidding system schema + seed + atomic bid function
-- Paste the full file into Supabase SQL Editor and run once (or re-run safely).
-- Depends on: gen_random_uuid() (pgcrypto — enabled by default on Supabase).
-- =============================================================================

-- Idempotent: matches 001_init.sql if you already ran that migration.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── buildings ───────────────────────────────────────────────────────────────

create table if not exists public.buildings (
  id                       uuid primary key default gen_random_uuid(),
  name                     text        not null unique,
  reward_value             integer     not null check (reward_value >= 0),
  min_buy_in               integer     not null check (min_buy_in > 0),
  cap_value                integer     not null check (cap_value >= 0),
  type                     text        not null default 'normal',
  status                   text        not null default 'active',
  state                    text        not null default 'idleState',
  expires_at               timestamptz,
  countdown_days           numeric(10, 2),
  max_snipe_count          integer     not null default 0 check (max_snipe_count >= 0),
  construction_time        integer     not null default 0 check (construction_time >= 0),
  last_bid_at              timestamptz,
  last_winner_username     text,
  last_winner_payout       integer,
  last_winner_bid          integer,
  last_winner_resolved_at  timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_buildings_status
  on public.buildings (status);

-- ─── building_bids (full history) ────────────────────────────────────────────

create table if not exists public.building_bids (
  id           uuid primary key default gen_random_uuid(),
  building_id  uuid        not null references public.buildings (id) on delete cascade,
  player_id    text        not null,
  amount       integer     not null check (amount > 0),
  bid_at       timestamptz not null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_building_bids_building_bid_at
  on public.building_bids (building_id, bid_at desc);

create index if not exists idx_building_bids_player
  on public.building_bids (player_id);

-- ─── building_bid_totals (cumulative total per player per building) ──────────

create table if not exists public.building_bid_totals (
  building_id   uuid        not null references public.buildings (id) on delete cascade,
  player_id     text        not null,
  total_amount  bigint      not null default 0 check (total_amount >= 0),
  updated_at    timestamptz not null default now(),
  primary key (building_id, player_id)
);

create index if not exists idx_building_bid_totals_building
  on public.building_bid_totals (building_id);

-- ─── updated_at triggers (reuse shared helper if already present) ───────────

drop trigger if exists buildings_set_updated_at on public.buildings;
drop trigger if exists building_bid_totals_set_updated_at on public.building_bid_totals;

create trigger buildings_set_updated_at
  before update on public.buildings
  for each row
  execute procedure public.set_updated_at();

create trigger building_bid_totals_set_updated_at
  before update on public.building_bid_totals
  for each row
  execute procedure public.set_updated_at();

-- ─── Atomic bid placement (transactional) ──────────────────────────────────

create or replace function public.place_building_bid(
  p_building_name text,
  p_player_id text,
  p_amount        integer,
  p_bid_at        timestamptz
)
returns jsonb
language plpgsql
as $$
declare
  v_building public.buildings%rowtype;
begin
  if p_building_name is null or length(trim(p_building_name)) = 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_INPUT',
      'message', 'buildingName is required.'
    );
  end if;

  if p_player_id is null or length(trim(p_player_id)) = 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_INPUT',
      'message', 'playerId is required.'
    );
  end if;

  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_AMOUNT',
      'message', 'amount must be a positive integer.'
    );
  end if;

  select *
 into v_building from public.buildings where name = p_building_name
   for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'NOT_FOUND',
      'message', 'Building not found.'
    );
  end if;

  if v_building.status is distinct from 'active' then
    return jsonb_build_object(
      'ok', false,
      'code', 'NOT_ACTIVE',
      'message', 'Building is not active.'
    );
  end if;

  if p_amount < v_building.min_buy_in then
    return jsonb_build_object(
      'ok', false,
      'code', 'BELOW_MIN',
      'message', format('Bid must be at least %s.', v_building.min_buy_in)
    );
  end if;

  insert into public.building_bids (building_id, player_id, amount, bid_at)
  values (v_building.id, p_player_id, p_amount, p_bid_at);

  insert into public.building_bid_totals (building_id, player_id, total_amount)
  values (v_building.id, p_player_id, p_amount::bigint)
  on conflict (building_id, player_id) do update
    set total_amount = public.building_bid_totals.total_amount + excluded.total_amount,
        updated_at   = now();

  update public.buildings
     set last_bid_at = p_bid_at,
         updated_at  = now()
   where id = v_building.id;

  return jsonb_build_object(
    'ok', true,
    'buildingId', v_building.id
  );
end;
$$;

revoke all on function public.place_building_bid(text, text, integer, timestamptz) from public;
grant execute on function public.place_building_bid(text, text, integer, timestamptz) to postgres;
grant execute on function public.place_building_bid(text, text, integer, timestamptz) to service_role;

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- Backend uses the Supabase service role key (bypasses RLS). These tables are
-- not exposed to the anon key in a typical setup.

alter table public.buildings           enable row level security;
alter table public.building_bids       enable row level security;
alter table public.building_bid_totals enable row level security;

-- ─── Seed: 8 buildings ─────────────────────────────────────────────────────

insert into public.buildings (
  name,
  reward_value,
  min_buy_in,
  cap_value,
  type,
  status,
  state,
  expires_at,
  countdown_days,
  max_snipe_count,
  construction_time,
  last_bid_at,
  last_winner_username,
  last_winner_payout,
  last_winner_bid,
  last_winner_resolved_at
) values
  (
    'NexusFinanceTower',
    8000,
    800,
    16000,
    'normal',
    'active',
    'surgeState',
    '2025-04-06T10:22:00Z',
    6.5,
    3,
    1,
    '2025-04-02T14:05:00Z',
    'player_m3p1',
    16000,
    8000,
    '2025-03-28T08:00:00Z'
  ),
  (
    'SkylinePlaza',
    6000,
    600,
    12000,
    'normal',
    'active',
    'surgeState',
    '2025-04-08T18:00:00Z',
    5.25,
    2,
    2,
    '2025-04-01T09:30:00Z',
    'player_k8d2',
    12000,
    6000,
    '2025-03-20T14:30:00Z'
  ),
  (
    'MeridianSpire',
    5000,
    500,
    10000,
    'normal',
    'active',
    'cooldownState',
    '2025-04-10T12:00:00Z',
    4.0,
    3,
    1,
    null,
    null,
    null,
    null,
    null
  ),
  (
    'AuroraCommons',
    4500,
    450,
    9000,
    'normal',
    'active',
    'surgeState',
    '2025-04-07T08:15:00Z',
    7.0,
    2,
    3,
    null,
    null,
    null,
    null,
    null
  ),
  (
    'VelocityExchange',
    7000,
    700,
    14000,
    'normal',
    'active',
    'surgeState',
    '2025-04-05T16:45:00Z',
    3.75,
    4,
    2,
    null,
    null,
    null,
    null,
    null
  ),
  (
    'CrimsonHarbor',
    5500,
    550,
    11000,
    'normal',
    'active',
    'idleState',
    '2025-04-12T20:00:00Z',
    8.5,
    2,
    1,
    null,
    null,
    null,
    null,
    null
  ),
  (
    'EchoGardens',
    4000,
    400,
    8000,
    'normal',
    'active',
    'surgeState',
    '2025-04-09T11:30:00Z',
    2.5,
    3,
    1,
    null,
    null,
    null,
    null,
    null
  ),
  (
    'TitaniumFoundry',
    9000,
    900,
    18000,
    'normal',
    'active',
    'surgeState',
    '2025-04-04T07:00:00Z',
    9.25,
    5,
    4,
    null,
    null,
    null,
    null,
    null
  )
on conflict (name) do update set
  reward_value = excluded.reward_value,
  min_buy_in               = excluded.min_buy_in,
  cap_value                = excluded.cap_value,
  type                     = excluded.type,
  status                   = excluded.status,
  state                    = excluded.state,
  expires_at               = excluded.expires_at,
  countdown_days           = excluded.countdown_days,
  max_snipe_count          = excluded.max_snipe_count,
  construction_time        = excluded.construction_time,
  last_bid_at              = excluded.last_bid_at,
  last_winner_username     = excluded.last_winner_username,
  last_winner_payout       = excluded.last_winner_payout,
  last_winner_bid          = excluded.last_winner_bid,
  last_winner_resolved_at  = excluded.last_winner_resolved_at,
  updated_at               = now();
