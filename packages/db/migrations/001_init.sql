-- Контур — начальная схема. ТЗ §5, все таблицы сразу целиком.
-- Накатывается на чистую БД одной командой (приёмка этапа 0).

-- ─── 5.1 Постоянные данные ──────────────────────────────────────────

create table if not exists users (
  id                bigserial primary key,
  tg_id             bigint      not null unique,
  username          text,
  created_at        timestamptz not null default now(),
  last_seen_at      timestamptz,
  is_member         boolean     not null default false,
  member_checked_at timestamptz,
  banned_at         timestamptz,
  -- I11: кроме tg_id и username ничего не храним.
  -- Настройки уведомлений — не персональные данные, а состояние игры.
  push_enabled      boolean     not null default true,
  quiet_from_hour   int         not null default 20,   -- 23:00 МСК в UTC
  quiet_to_hour     int         not null default 6,    -- 09:00 МСК в UTC
  push_misses       int         not null default 0
);

create table if not exists profiles (
  user_id       bigint       primary key references users(id) on delete cascade,
  seasons_done  int          not null default 0,
  prestige_mult numeric(4,2) not null default 1.00,
  bird_skin     text         not null default 'default',
  nest_skin     text         not null default 'default',
  decor         text[]       not null default '{}'
);

create table if not exists shiny_catalog (
  code       text primary key,
  season_idx int  not null,
  set_code   text not null,
  title      text not null,
  rarity     text not null check (rarity in ('common','rare','unique')),
  unlocks    jsonb not null default '{}'
);

create table if not exists player_shinies (
  user_id     bigint not null references users(id) on delete cascade,
  shiny_code  text   not null references shiny_catalog(code),
  obtained_at timestamptz not null default now(),
  primary key (user_id, shiny_code)
);

-- ─── 5.2 Сезонное состояние ─────────────────────────────────────────

create table if not exists seasons (
  id        serial primary key,
  idx       int         not null unique,
  starts_at timestamptz not null,
  ends_at   timestamptz not null,
  state     text        not null check (state in ('planned','active','closed'))
);
create unique index if not exists one_active_season
  on seasons (state) where state = 'active';

create table if not exists player_season (
  user_id            bigint not null references users(id) on delete cascade,
  season_id          int    not null references seasons(id),
  nest_level         int    not null default 1  check (nest_level between 1 and 25),
  worms              bigint not null default 0  check (worms >= 0),
  branches           bigint not null default 0  check (branches >= 0),
  collected_at       timestamptz not null default now(),
  streak_days        int    not null default 0  check (streak_days >= 0),
  streak_game_day    int,
  freezes            int    not null default 0  check (freezes between 0 and 3),
  freeze_granted_day int,
  forays_since_shiny int    not null default 0,
  unique_materials   jsonb  not null default '{}',
  joined_at          timestamptz not null default now(),
  -- Игровой день, в котором была списана заморозка / сорвался стрик.
  -- Нужны, чтобы POST /collect сообщил об этом (§7.2) независимо от того,
  -- какой именно запрос первым сдвинул игровой день.
  last_freeze_used_day  int,
  last_streak_break_day int,
  primary key (user_id, season_id)
);

-- ─── 5.3 Контракты и репутация ──────────────────────────────────────

create table if not exists contracts (
  id          bigserial primary key,
  season_id   int    not null references seasons(id),
  game_day    int    not null,
  a_user_id   bigint not null references users(id),
  b_user_id   bigint not null references users(id),
  a_choice    text   check (a_choice in ('help','steal')),
  b_choice    text   check (b_choice in ('help','steal')),
  a_payoff    int,
  b_payoff    int,
  state       text   not null default 'open'
                     check (state in ('open','resolved','expired')),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  resolved_at timestamptz,
  check (a_user_id < b_user_id)
);
create unique index if not exists contracts_day_a on contracts (season_id, game_day, a_user_id);
create unique index if not exists contracts_day_b on contracts (season_id, game_day, b_user_id);
create index if not exists contracts_pair on contracts (season_id, a_user_id, b_user_id);
create index if not exists contracts_open on contracts (state, expires_at);

create table if not exists reputation_events (
  id          bigserial primary key,
  user_id     bigint  not null references users(id) on delete cascade,
  contract_id bigint  not null references contracts(id),
  cooperated  boolean not null,
  created_at  timestamptz not null default now(),
  unique (user_id, contract_id)
);
create index if not exists rep_by_user on reputation_events (user_id, created_at desc);

-- ─── 5.4 Зима ───────────────────────────────────────────────────────

create table if not exists winters (
  id           bigserial primary key,
  season_id    int    not null references seasons(id) unique,
  threshold    bigint not null,
  collected    bigint not null default 0,
  active_count int    not null default 1,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  state        text   not null default 'active'
                      check (state in ('active','survived','failed'))
);

create table if not exists winter_contributions (
  id         bigserial primary key,
  winter_id  bigint not null references winters(id),
  user_id    bigint not null references users(id),
  amount     bigint not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index if not exists winter_contrib on winter_contributions (winter_id, user_id);

-- ─── 5.5 Мост в реальность ──────────────────────────────────────────

create table if not exists real_actions (
  id            bigserial primary key,
  user_id       bigint not null references users(id),
  season_id     int    not null references seasons(id),
  kind          text   not null check (kind in ('cu_event','agency_case','own_project')),
  title         text   not null,
  description   text   not null,
  evidence_url  text,
  state         text   not null default 'pending'
                       check (state in ('pending','approved','rejected')),
  submitted_at  timestamptz not null default now(),
  reviewed_by   bigint references users(id),
  reviewed_at   timestamptz,
  reject_reason text
);
create index if not exists real_actions_by_user on real_actions (user_id);
create index if not exists real_actions_pending on real_actions (state, submitted_at);

create table if not exists signal_cards (
  id             bigserial primary key,
  user_id        bigint not null references users(id),
  real_action_id bigint not null references real_actions(id) unique,
  verifiable     jsonb  not null,
  attribution    jsonb  not null,
  reproducible   jsonb  not null,
  issued_at      timestamptz not null default now()
);
create index if not exists signal_cards_by_user on signal_cards (user_id);

-- ─── 5.6 Служебные ──────────────────────────────────────────────────

create table if not exists config (
  key        text primary key,
  value      jsonb       not null,
  updated_at timestamptz not null default now()
);

create table if not exists events (
  id         bigserial primary key,
  user_id    bigint references users(id),
  season_id  int    references seasons(id),
  type       text   not null,
  payload    jsonb  not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists events_by_type on events (type, created_at desc);
create index if not exists events_by_user on events (user_id, created_at desc);

create table if not exists idempotency (
  key        text   primary key,
  endpoint   text   not null,
  response   jsonb  not null,
  created_at timestamptz not null default now()
);
create index if not exists idempotency_age on idempotency (created_at);

create table if not exists push_log (
  id        bigserial primary key,
  user_id   bigint not null references users(id),
  game_day  int    not null,
  kind      text   not null,
  sent_at   timestamptz not null default now(),
  opened_at timestamptz
);
-- I10, выраженный уникальным индексом: ошибка вставки означает
-- «сегодня уже отправляли» и обрабатывается как штатная ситуация
create unique index if not exists one_push_per_day on push_log (user_id, game_day);

-- Один пост в чат в сутки — тот же приём (I10)
create table if not exists chat_post_log (
  game_day  int primary key,
  posted_at timestamptz not null default now()
);

-- Идемпотентность крон-задач по (тип, game_day) — §10
create table if not exists cron_log (
  job      text not null,
  game_day int  not null,
  ran_at   timestamptz not null default now(),
  primary key (job, game_day)
);
