-- Новый путь участия рядом с прежней игровой системой.
-- Схема повторяет D1-миграцию 0003 без переноса старой экономики.

create table if not exists participation_profiles (
  user_id bigint primary key references users(id) on delete cascade,
  stage text not null default 'looking'
    check (stage in ('looking','thread','nest','connection')),
  current_intent text
    check (current_intent in ('orient','ask','help','return')),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pilot_chats (
  id bigserial primary key,
  code text not null unique check (length(code) between 1 and 40),
  title text not null check (length(title) between 1 and 80),
  purpose text not null check (length(purpose) between 1 and 240),
  kind text not null check (kind in ('general','specialist')),
  telegram_chat_id bigint unique,
  active boolean not null default false,
  position int not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists journeys (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  pilot_chat_id bigint references pilot_chats(id),
  intent text not null check (intent in ('orient','ask','help','return')),
  status text not null default 'started'
    check (status in (
      'started','prepared','published','waiting','helped','clarify','saved','done','closed'
    )),
  source_chat_id bigint,
  source_message_id bigint check (source_message_id is null or source_message_id > 0),
  reply_message_id bigint check (reply_message_id is null or reply_message_id > 0),
  message_link text check (message_link is null or length(message_link) <= 500),
  client_request_id text not null check (length(client_request_id) between 8 and 128),
  prepared_at timestamptz,
  published_at timestamptz,
  outcome_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_request_id)
);
create index if not exists journeys_by_user on journeys (user_id, updated_at desc);
create index if not exists journeys_by_message
  on journeys (source_chat_id, source_message_id)
  where source_chat_id is not null and source_message_id is not null;
create unique index if not exists one_active_journey_per_user
  on journeys (user_id)
  where status not in ('done','closed');

create table if not exists help_confirmations (
  id bigserial primary key,
  journey_id bigint not null references journeys(id) on delete cascade,
  requester_user_id bigint not null references users(id) on delete cascade,
  helper_user_id bigint not null references users(id) on delete cascade,
  source_chat_id bigint not null,
  source_message_id bigint not null check (source_message_id > 0),
  reply_message_id bigint not null check (reply_message_id > 0),
  status text not null check (status in ('helped','clarify','review')),
  rejection_reason text,
  client_request_id text not null check (length(client_request_id) between 8 and 128),
  created_at timestamptz not null default now(),
  check (requester_user_id <> helper_user_id),
  check (source_message_id <> reply_message_id),
  unique (source_chat_id, source_message_id, reply_message_id),
  unique (requester_user_id, client_request_id)
);
create index if not exists confirmations_by_helper
  on help_confirmations (helper_user_id, created_at desc);
create index if not exists confirmations_by_pair
  on help_confirmations (requester_user_id, helper_user_id, created_at desc);

create table if not exists nest_items (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  journey_id bigint not null unique references journeys(id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 120),
  status text not null check (status in ('waiting','helped','clarify','done')),
  message_link text check (message_link is null or length(message_link) <= 500),
  next_step text check (next_step is null or length(trim(next_step)) between 1 and 240),
  client_request_id text not null check (length(client_request_id) between 8 and 128),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, client_request_id)
);
create index if not exists nest_items_by_user
  on nest_items (user_id, updated_at desc)
  where deleted_at is null;

create table if not exists journey_events (
  id bigserial primary key,
  user_id bigint references users(id) on delete set null,
  journey_id bigint references journeys(id) on delete set null,
  type text not null check (type in (
    'journey_started','question_prepared','chat_opened','message_linked',
    'reply_observed','outcome_helped','outcome_clarify','result_saved',
    'next_step_opened','returned_other_day'
  )),
  experience_version text not null default 'v2' check (experience_version = 'v2'),
  client text not null default 'unknown'
    check (client in ('desktop','ios','android','web','unknown')),
  created_at timestamptz not null default now()
);
create index if not exists journey_events_by_type on journey_events (type, created_at desc);
create index if not exists journey_events_by_created_at on journey_events (created_at);
