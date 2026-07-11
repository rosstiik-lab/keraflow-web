create table if not exists public.client_price_overrides (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  client_id uuid not null,
  price_item_id uuid not null,
  price numeric not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint client_price_overrides_owner_client_item_key unique (owner_id, client_id, price_item_id),
  constraint client_price_overrides_client_id_fkey foreign key (client_id) references public.clients(id) on delete cascade,
  constraint client_price_overrides_price_item_id_fkey foreign key (price_item_id) references public.price_items(id) on delete cascade
);

alter table public.client_price_overrides enable row level security;

drop policy if exists "Users can read own client price overrides" on public.client_price_overrides;
create policy "Users can read own client price overrides"
  on public.client_price_overrides
  for select
  using (auth.uid() = owner_id);

drop policy if exists "Users can insert own client price overrides" on public.client_price_overrides;
create policy "Users can insert own client price overrides"
  on public.client_price_overrides
  for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Users can update own client price overrides" on public.client_price_overrides;
create policy "Users can update own client price overrides"
  on public.client_price_overrides
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Users can delete own client price overrides" on public.client_price_overrides;
create policy "Users can delete own client price overrides"
  on public.client_price_overrides
  for delete
  using (auth.uid() = owner_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_client_price_overrides_updated_at on public.client_price_overrides;
create trigger set_client_price_overrides_updated_at
  before update on public.client_price_overrides
  for each row
  execute function public.set_updated_at();
