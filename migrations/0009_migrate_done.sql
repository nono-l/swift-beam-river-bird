-- 前のドメインから一度だけ引継いだメール。二度目は拒否する。
create table if not exists migrate_done (
  email text primary key,
  pulled_at timestamptz not null default now()
);
