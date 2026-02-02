-- Accounts (one per provider identity)
create table if not exists inventory_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  provider text not null,
  provider_account_id text not null,
  display_name text,
  primary_email text,
  raw_profile_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, provider_account_id)
);

create index if not exists inventory_accounts_lookup_idx
  on inventory_accounts (user_id, provider, provider_account_id);
