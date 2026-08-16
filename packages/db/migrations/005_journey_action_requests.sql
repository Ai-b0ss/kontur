-- Идемпотентность каждого изменяющего действия новой версии.

create table if not exists journey_action_requests (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  client_request_id text not null check (length(client_request_id) between 8 and 128),
  action text not null check (action in (
    'journey_start','journey_prepared','journey_published','journey_outcome_helped',
    'journey_outcome_clarify','journey_outcome_saved','nest_save',
    'nest_next_step','nest_delete','journey_close'
  )),
  journey_id bigint references journeys(id) on delete cascade,
  nest_item_id bigint references nest_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, client_request_id)
);
create index if not exists journey_action_requests_by_created_at
  on journey_action_requests (created_at);
