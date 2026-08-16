-- Разворот продукта: червяки приходят от людей, а не из гнезда.
-- Убираем механики старой экономики и добавляем роли, кошелёк и гачу.

-- ─── убираем мёртвое ────────────────────────────────────────────────
-- Порядок важен из-за внешних ключей.

drop table if exists winter_contributions;
drop table if exists winters;
drop table if exists reputation_events;
drop table if exists contracts;
drop table if exists player_shinies;
drop table if exists shiny_catalog;
drop table if exists player_season;

-- real_actions и signal_cards намеренно оставлены: они ничего не стоят,
-- ни на что не влияют и сохраняют возможность вернуть мост в реальность.

-- ─── вход только через /start ───────────────────────────────────────
-- Без диалога в личке боту некуда слать пуши, а пуши — половина продукта.
-- Поэтому прямой вход по ссылке в мини-апп не пускаем.

alter table users add column if not exists started_bot_at timestamptz;

-- ─── птица игрока ───────────────────────────────────────────────────

alter table profiles add column if not exists role text
  check (role in ('designer','coder','creative','manager','vibe'));
alter table profiles add column if not exists coloring text not null default 'plain';
alter table profiles add column if not exists hatched_at timestamptz;
alter table profiles add column if not exists bird_name text;

-- Старые поля кастомизации больше не используются
alter table profiles drop column if exists bird_skin;
alter table profiles drop column if exists nest_skin;
alter table profiles drop column if exists decor;
alter table profiles drop column if exists seasons_done;
alter table profiles drop column if exists prestige_mult;

create table if not exists onboarding_answers (
  user_id    bigint primary key references users(id) on delete cascade,
  answers    jsonb  not null,
  role       text   not null,
  scores     jsonb  not null,
  created_at timestamptz not null default now()
);

-- ─── две валюты ─────────────────────────────────────────────────────
-- reputation только растёт и не тратится — по ней рейтинг.
-- wallet тратится на яйца. Если сделать одну, люди перестанут тратить,
-- чтобы не терять место в топе, и экономика встанет.

create table if not exists wallets (
  user_id             bigint primary key references users(id) on delete cascade,
  wallet              bigint not null default 0 check (wallet >= 0),
  reputation          bigint not null default 0 check (reputation >= 0),
  passive_collected_day int,
  updated_at          timestamptz not null default now()
);

-- ─── переводы червяков ──────────────────────────────────────────────

create table if not exists worm_grants (
  id              bigserial primary key,
  from_user_id    bigint not null references users(id),
  to_user_id      bigint not null references users(id),
  amount          int    not null check (amount > 0),
  reason          text,
  chat_message_id bigint,
  game_day        int    not null,
  created_at      timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);

-- Один червяк одному человеку в сутки — выражено индексом, а не только кодом
create unique index if not exists one_grant_per_pair_per_day
  on worm_grants (from_user_id, to_user_id, game_day);

create index if not exists grants_to_user on worm_grants (to_user_id, created_at desc);
create index if not exists grants_from_day on worm_grants (from_user_id, game_day);
create index if not exists grants_recent on worm_grants (created_at desc);

-- ─── окрасы ─────────────────────────────────────────────────────────

create table if not exists colorings (
  code    text primary key,
  title   text not null,
  rarity  text not null check (rarity in ('common','rare','legendary')),
  palette jsonb not null,
  weight  int  not null check (weight > 0)
);

create table if not exists player_colorings (
  user_id       bigint not null references users(id) on delete cascade,
  coloring_code text   not null references colorings(code),
  obtained_at   timestamptz not null default now(),
  primary key (user_id, coloring_code)
);

-- ─── гнездо: кто заходил ────────────────────────────────────────────

create table if not exists nest_visits (
  id         bigserial primary key,
  visitor_id bigint not null references users(id) on delete cascade,
  host_id    bigint not null references users(id) on delete cascade,
  game_day   int    not null,
  created_at timestamptz not null default now(),
  check (visitor_id <> host_id),
  unique (visitor_id, host_id, game_day)
);
create index if not exists visits_to_host on nest_visits (host_id, created_at desc);

-- ─── выпадения из яиц (для анонсов и ленты) ─────────────────────────

create table if not exists egg_pulls (
  id            bigserial primary key,
  user_id       bigint not null references users(id) on delete cascade,
  coloring_code text   not null references colorings(code),
  duplicate     boolean not null default false,
  announced     boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists pulls_pending_announce
  on egg_pulls (announced, created_at) where announced = false;
