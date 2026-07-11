create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  object_id uuid not null,
  status text not null default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint proposals_owner_object_key unique (owner_id, object_id),
  constraint proposals_object_id_fkey foreign key (object_id) references public.objects(id) on delete cascade
);

create table if not exists public.proposal_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  proposal_id uuid not null,
  source_price_item_id uuid null,
  title text not null,
  unit text,
  quantity numeric not null default 0,
  price numeric not null default 0,
  currency text,
  note text,
  base_price_snapshot numeric,
  client_price_snapshot numeric,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint proposal_items_proposal_id_fkey foreign key (proposal_id) references public.proposals(id) on delete cascade,
  constraint proposal_items_source_price_item_id_fkey foreign key (source_price_item_id) references public.price_items(id) on delete set null
);

alter table public.proposals enable row level security;
alter table public.proposal_items enable row level security;

drop policy if exists "Users can read own proposals" on public.proposals;
create policy "Users can read own proposals" on public.proposals for select using (auth.uid() = owner_id);
drop policy if exists "Users can insert own proposals" on public.proposals;
create policy "Users can insert own proposals" on public.proposals for insert with check (auth.uid() = owner_id);
drop policy if exists "Users can update own proposals" on public.proposals;
create policy "Users can update own proposals" on public.proposals for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "Users can delete own proposals" on public.proposals;
create policy "Users can delete own proposals" on public.proposals for delete using (auth.uid() = owner_id);

drop policy if exists "Users can read own proposal items" on public.proposal_items;
create policy "Users can read own proposal items" on public.proposal_items for select using (auth.uid() = owner_id);
drop policy if exists "Users can insert own proposal items" on public.proposal_items;
create policy "Users can insert own proposal items" on public.proposal_items for insert with check (auth.uid() = owner_id);
drop policy if exists "Users can update own proposal items" on public.proposal_items;
create policy "Users can update own proposal items" on public.proposal_items for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "Users can delete own proposal items" on public.proposal_items;
create policy "Users can delete own proposal items" on public.proposal_items for delete using (auth.uid() = owner_id);

drop trigger if exists set_proposals_updated_at on public.proposals;
create trigger set_proposals_updated_at
  before update on public.proposals
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_proposal_items_updated_at on public.proposal_items;
create trigger set_proposal_items_updated_at
  before update on public.proposal_items
  for each row
  execute function public.set_updated_at();
