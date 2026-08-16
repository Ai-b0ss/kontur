-- Одно личное напоминание только после явного согласия участника.

create table if not exists journey_reminders (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  nest_item_id bigint not null unique references nest_items(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','sent','cancelled')),
  due_at timestamptz not null default (now() + interval '1 day'),
  client_request_id text not null check (length(client_request_id) between 8 and 128),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_request_id)
);
create index if not exists journey_reminders_due
  on journey_reminders (status, due_at);
