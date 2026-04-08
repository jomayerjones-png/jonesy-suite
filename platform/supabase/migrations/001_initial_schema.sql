-- Jonesy&Co Platform Schema
-- Run this in your Supabase SQL editor to set up the database

-- Organizations (Jonesy&Co is the first)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now()
);

-- Team members
create table team_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  name text not null,
  email text not null,
  created_at timestamptz default now()
);

-- Clients (LIFE, Status, Prof G, etc.)
create table clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  company text,
  industry text,
  key_contact text,
  contact_email text,
  retainer_status text not null default 'active' check (retainer_status in ('active', 'at_risk', 'renewal_due', 'churned')),
  contract_start date,
  contract_end date,
  monthly_retainer numeric default 0,
  commission_rate numeric default 0,
  brand_color text default '#C9A84C',
  logo_initial text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Service stages (7 per client)
create table service_stages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  stage text not null check (stage in ('strategy', 'pipeline', 'activation', 'introductions', 'production', 'execution', 'renewal')),
  status text not null default 'not_started' check (status in ('complete', 'in_progress', 'not_started')),
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  sort_order int not null,
  created_at timestamptz default now()
);

-- Pipeline prospects (deals being worked for each client)
create table pipeline_prospects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  company text,
  stage text not null default 'intro_call' check (stage in ('intro_call', 'meeting_set', 'proposal_sent', 'negotiation', 'stalled', 'closed_won', 'closed_lost')),
  value numeric default 0,
  owner text,
  key_contact text,
  contact_email text,
  notes text,
  last_activity_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Prospect activities (timeline of actions on a deal)
create table prospect_activities (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references pipeline_prospects(id) on delete cascade,
  activity_type text not null check (activity_type in ('email', 'call', 'meeting', 'note', 'stage_change', 'proposal')),
  title text not null,
  body text,
  created_at timestamptz default now()
);

-- Action items (split by owner)
create table action_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  prospect_id uuid references pipeline_prospects(id) on delete set null,
  title text not null,
  owner_type text not null check (owner_type in ('jonesy', 'client')),
  assignee text,
  due_date date,
  completed boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- Client updates (manual + gmail-pulled)
create table client_updates (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  prospect_id uuid references pipeline_prospects(id) on delete set null,
  source text not null check (source in ('email', 'manual', 'meeting')),
  title text not null,
  body text,
  action_required boolean default false,
  gmail_thread_id text,
  gmail_message_id text,
  from_address text,
  created_at timestamptz default now()
);

-- Proposals
create table proposals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  prospect_id uuid references pipeline_prospects(id) on delete set null,
  title text not null,
  content text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'upcoming')),
  briefing jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Weekly reports
create table weekly_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  week_start date not null,
  pipeline_updates text,
  meetings text,
  actions text,
  next_focus text,
  stats jsonb,
  created_at timestamptz default now()
);

-- BD Leads (pre-client brainstorming pipeline)
create table bd_leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  team_lead text,
  status text not null default 'contact' check (status in ('contact', 'engaged', 'proposal_sent', 'closed', 'need_contact')),
  partner text not null,
  sector text,
  key_contact text,
  tier text check (tier in ('tier_0', 'tier_1', 'tier_2', 'tier_3')),
  editorial_concept text,
  est_value numeric default 0,
  source text,
  intro_made boolean default false,
  moved_to_suite boolean default false,
  next_step text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Email sync config (for Gmail integration)
create table email_configs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  gmail_refresh_token text,
  gmail_access_token text,
  gmail_token_expiry timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz default now()
);

-- Indexes
create index idx_clients_org on clients(org_id);
create index idx_service_stages_client on service_stages(client_id);
create index idx_pipeline_prospects_client on pipeline_prospects(client_id);
create index idx_action_items_client on action_items(client_id);
create index idx_action_items_due on action_items(due_date) where completed = false;
create index idx_client_updates_client on client_updates(client_id);
create index idx_proposals_client on proposals(client_id);
create index idx_bd_leads_org on bd_leads(org_id);

-- Row Level Security
alter table organizations enable row level security;
alter table team_members enable row level security;
alter table clients enable row level security;
alter table service_stages enable row level security;
alter table pipeline_prospects enable row level security;
alter table prospect_activities enable row level security;
alter table action_items enable row level security;
alter table client_updates enable row level security;
alter table proposals enable row level security;
alter table weekly_reports enable row level security;
alter table bd_leads enable row level security;
alter table email_configs enable row level security;

-- RLS Policies: team members can access their org's data
create policy "Team members can view their org"
  on organizations for select
  using (id in (select org_id from team_members where user_id = auth.uid()));

create policy "Team members can view their org's clients"
  on clients for all
  using (org_id in (select org_id from team_members where user_id = auth.uid()));

create policy "Team members can manage service stages"
  on service_stages for all
  using (client_id in (select id from clients where org_id in (select org_id from team_members where user_id = auth.uid())));

create policy "Team members can manage prospects"
  on pipeline_prospects for all
  using (client_id in (select id from clients where org_id in (select org_id from team_members where user_id = auth.uid())));

create policy "Team members can manage activities"
  on prospect_activities for all
  using (prospect_id in (select id from pipeline_prospects where client_id in (select id from clients where org_id in (select org_id from team_members where user_id = auth.uid()))));

create policy "Team members can manage action items"
  on action_items for all
  using (client_id in (select id from clients where org_id in (select org_id from team_members where user_id = auth.uid())));

create policy "Team members can manage updates"
  on client_updates for all
  using (client_id in (select id from clients where org_id in (select org_id from team_members where user_id = auth.uid())));

create policy "Team members can manage proposals"
  on proposals for all
  using (client_id in (select id from clients where org_id in (select org_id from team_members where user_id = auth.uid())));

create policy "Team members can manage reports"
  on weekly_reports for all
  using (client_id in (select id from clients where org_id in (select org_id from team_members where user_id = auth.uid())));

create policy "Team members can manage BD leads"
  on bd_leads for all
  using (org_id in (select org_id from team_members where user_id = auth.uid()));

create policy "Team members can view team"
  on team_members for select
  using (org_id in (select org_id from team_members where user_id = auth.uid()));

create policy "Team members can manage email config"
  on email_configs for all
  using (org_id in (select org_id from team_members where user_id = auth.uid()));

-- Seed: Create Jonesy&Co organization
insert into organizations (name, slug) values ('Jonesy&Co', 'jonesy-co');

-- Seed: Create initial clients
insert into clients (org_id, name, company, industry, retainer_status, brand_color, logo_initial)
select o.id, c.name, c.company, c.industry, c.retainer_status, c.brand_color, c.logo_initial
from organizations o
cross join (values
  ('LIFE', 'LIFE Magazine', 'Media', 'active', '#DC2626', 'L'),
  ('Status', 'Status Media', 'Media', 'active', '#DC2626', 'S'),
  ('Prof G', 'Prof G Media', 'Media', 'active', '#2D8A4E', 'G')
) as c(name, company, industry, retainer_status, brand_color, logo_initial)
where o.slug = 'jonesy-co';

-- Seed: Create 7 service stages for each client
insert into service_stages (client_id, stage, status, sort_order)
select c.id, s.stage, s.status, s.sort_order
from clients c
cross join (values
  ('strategy', 'complete', 1),
  ('pipeline', 'in_progress', 2),
  ('activation', 'not_started', 3),
  ('introductions', 'not_started', 4),
  ('production', 'not_started', 5),
  ('execution', 'not_started', 6),
  ('renewal', 'not_started', 7)
) as s(stage, status, sort_order);

-- Updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger clients_updated_at before update on clients for each row execute function update_updated_at();
create trigger pipeline_prospects_updated_at before update on pipeline_prospects for each row execute function update_updated_at();
create trigger proposals_updated_at before update on proposals for each row execute function update_updated_at();
create trigger bd_leads_updated_at before update on bd_leads for each row execute function update_updated_at();
