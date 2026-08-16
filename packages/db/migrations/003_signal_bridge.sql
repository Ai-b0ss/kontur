-- Минимальный мост чатового MVP в реальные действия.
-- Старые таблицы real_actions и signal_cards были сохранены миграцией 002,
-- но требовали сезон. Текущий MVP бессезонный, поэтому карта может жить сама.

alter table real_actions alter column season_id drop not null;
alter table real_actions add column if not exists reference_code text;

create unique index if not exists real_actions_reference_code
  on real_actions (reference_code)
  where reference_code is not null;

create index if not exists signal_cards_issued
  on signal_cards (issued_at desc);

