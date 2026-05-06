-- =============================================================================
-- LWL pipeline — initial schema (Phase 1)
-- Idempotent: safe to re-run against an empty database.
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ----- helper: updated_at trigger function ----------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----- enums ----------------------------------------------------------------
do $$ begin
  create type public.lead_status as enum (
    'new','verified','emailed','registered','attended','offered','paid','lost','reengaged'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.email_template_kind as enum (
    'invite','reminder_24h','reminder_1h',
    'offer_d0','offer_d1','offer_d2_morning','offer_d2_final',
    'noshow','reengage','registration_confirmation','payment_receipt','resource_delivery'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.campaign_status as enum ('draft','running','paused','done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pipeline_stage as enum (
    'school_discovery','tier_verification','contact_enrichment',
    'linkedin_verification','email_validation','invite_send',
    'reminder_send','attendance_sync','offer_send','payment_received',
    'resource_delivery','reengage'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.event_status as enum ('started','success','error','skipped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.program_status as enum ('draft','active','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.masterclass_status as enum ('scheduled','live','completed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.offer_status as enum ('active','paid','expired','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pending','succeeded','refunded','failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.app_role as enum ('admin','operator','viewer');
exception when duplicate_object then null; end $$;

-- ----- programs --------------------------------------------------------------
create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  standard_price_cents integer not null check (standard_price_cents >= 0),
  offer_price_cents integer not null check (offer_price_cents >= 0),
  offer_window_hours integer not null default 72 check (offer_window_hours > 0),
  resource_pack_url text,
  brand_assets_url text,
  status public.program_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_programs_updated on public.programs;
create trigger trg_programs_updated before update on public.programs
  for each row execute function public.set_updated_at();

-- ----- masterclasses ---------------------------------------------------------
create table if not exists public.masterclasses (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  mentor_name text not null,
  mentor_bio text,
  topic text not null,
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  zoom_join_url text,
  zoom_meeting_id text,
  registration_page_slug text not null unique,
  status public.masterclass_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists masterclasses_program_idx on public.masterclasses(program_id);
create index if not exists masterclasses_scheduled_idx on public.masterclasses(scheduled_at);
drop trigger if exists trg_masterclasses_updated on public.masterclasses;
create trigger trg_masterclasses_updated before update on public.masterclasses
  for each row execute function public.set_updated_at();

-- ----- target_roles ----------------------------------------------------------
create table if not exists public.target_roles (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  role_title text not null,
  synonyms text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (program_id, role_title)
);
create index if not exists target_roles_program_idx on public.target_roles(program_id);

-- ----- school_tier_rules -----------------------------------------------------
create table if not exists public.school_tier_rules (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  min_tuition_usd integer not null check (min_tuition_usd >= 0),
  country text not null,
  school_types text[] not null default '{}',
  exclude_types text[] not null default '{}',
  scoring_weights jsonb not null default '{}'::jsonb,
  threshold_score integer not null default 70 check (threshold_score between 0 and 100),
  created_at timestamptz not null default now()
);
create index if not exists str_program_idx on public.school_tier_rules(program_id);

-- ----- schools_raw (pre-verification stash) ----------------------------------
create table if not exists public.schools_raw (
  id uuid primary key default gen_random_uuid(),
  name text,
  website text,
  country text,
  state text,
  city text,
  tuition_text text,
  school_type text,
  source text not null,
  raw_payload jsonb not null,
  fetched_at timestamptz not null default now()
);
create index if not exists schools_raw_source_idx on public.schools_raw(source);
create index if not exists schools_raw_website_idx on public.schools_raw(lower(website));

-- ----- schools (verified, in scope) -----------------------------------------
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  country text not null,
  state text,
  city text,
  tuition_usd integer,
  school_type text,
  source text,
  tier_match_score integer check (tier_match_score between 0 and 100),
  tier_verified boolean not null default false,
  tier_signals jsonb not null default '{}'::jsonb,
  raw_id uuid references public.schools_raw(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists schools_website_unique
  on public.schools (lower(website)) where website is not null;
create index if not exists schools_country_idx on public.schools(country);
create index if not exists schools_tier_verified_idx on public.schools(tier_verified);
drop trigger if exists trg_schools_updated on public.schools;
create trigger trg_schools_updated before update on public.schools
  for each row execute function public.set_updated_at();

-- ----- leads -----------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  first_name text,
  last_name text,
  role text,
  email citext not null,
  linkedin_url text,
  email_verified boolean not null default false,
  role_verified boolean not null default false,
  status public.lead_status not null default 'new',
  source text,
  idempotency_key text not null unique,
  replied boolean not null default false,
  bounced boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists leads_email_unique on public.leads (email);
create unique index if not exists leads_linkedin_unique
  on public.leads (lower(linkedin_url)) where linkedin_url is not null;
create index if not exists leads_school_idx on public.leads(school_id);
create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_created_idx on public.leads(created_at desc);
drop trigger if exists trg_leads_updated on public.leads;
create trigger trg_leads_updated before update on public.leads
  for each row execute function public.set_updated_at();

-- ----- campaigns -------------------------------------------------------------
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  masterclass_id uuid references public.masterclasses(id) on delete set null,
  name text not null,
  status public.campaign_status not null default 'draft',
  daily_send_cap integer not null default 200 check (daily_send_cap > 0),
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists campaigns_program_idx on public.campaigns(program_id);
create index if not exists campaigns_status_idx on public.campaigns(status);
drop trigger if exists trg_campaigns_updated on public.campaigns;
create trigger trg_campaigns_updated before update on public.campaigns
  for each row execute function public.set_updated_at();

-- ----- email_templates -------------------------------------------------------
create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  kind public.email_template_kind not null,
  subject text not null,
  body_md text not null,
  variables text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, kind)
);
create index if not exists email_templates_program_idx on public.email_templates(program_id);
drop trigger if exists trg_email_templates_updated on public.email_templates;
create trigger trg_email_templates_updated before update on public.email_templates
  for each row execute function public.set_updated_at();

-- ----- email_sends -----------------------------------------------------------
create table if not exists public.email_sends (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  template_id uuid references public.email_templates(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  provider text not null,
  provider_message_id text,
  status text not null default 'queued',
  opens integer not null default 0,
  clicks integer not null default 0,
  bounced boolean not null default false,
  replied boolean not null default false,
  sent_at timestamptz,
  idempotency_key text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists email_sends_provider_msg_unique
  on public.email_sends(provider_message_id) where provider_message_id is not null;
create unique index if not exists email_sends_idem_unique
  on public.email_sends(idempotency_key);
create index if not exists email_sends_lead_idx on public.email_sends(lead_id);
create index if not exists email_sends_campaign_idx on public.email_sends(campaign_id);

-- ----- registrations ---------------------------------------------------------
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  masterclass_id uuid not null references public.masterclasses(id) on delete cascade,
  registered_at timestamptz not null default now(),
  attended boolean not null default false,
  attendance_minutes integer,
  unique (lead_id, masterclass_id)
);
create index if not exists registrations_lead_idx on public.registrations(lead_id);
create index if not exists registrations_masterclass_idx on public.registrations(masterclass_id);

-- ----- offers ----------------------------------------------------------------
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete restrict,
  campaign_id uuid references public.campaigns(id) on delete set null,
  price_cents integer not null check (price_cents >= 0),
  expires_at timestamptz not null,
  stripe_checkout_url text,
  stripe_session_id text unique,
  status public.offer_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists offers_lead_idx on public.offers(lead_id);
create index if not exists offers_status_idx on public.offers(status);
create index if not exists offers_expires_idx on public.offers(expires_at);
drop trigger if exists trg_offers_updated on public.offers;
create trigger trg_offers_updated before update on public.offers
  for each row execute function public.set_updated_at();

-- ----- payments --------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete restrict,
  offer_id uuid references public.offers(id) on delete set null,
  stripe_payment_intent_id text not null unique,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'usd',
  status public.payment_status not null default 'pending',
  paid_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists payments_lead_idx on public.payments(lead_id);
create index if not exists payments_status_idx on public.payments(status);

-- ----- pipeline_events -------------------------------------------------------
create table if not exists public.pipeline_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  stage public.pipeline_stage not null,
  status public.event_status not null,
  payload_json jsonb,
  error_text text,
  created_at timestamptz not null default now()
);
create index if not exists pe_lead_idx on public.pipeline_events(lead_id);
create index if not exists pe_campaign_stage_idx on public.pipeline_events(campaign_id, stage);
create index if not exists pe_created_at_idx on public.pipeline_events(created_at desc);
create index if not exists pe_stage_status_idx on public.pipeline_events(stage, status);

-- ----- user_roles (Supabase auth.users is built-in) --------------------------
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_user_roles_updated on public.user_roles;
create trigger trg_user_roles_updated before update on public.user_roles
  for each row execute function public.set_updated_at();

-- ----- audit_log -------------------------------------------------------------
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_table text,
  target_id uuid,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_user_idx on public.audit_log(user_id);
create index if not exists audit_log_created_idx on public.audit_log(created_at desc);

-- ----- helper: current actor's role -----------------------------------------
create or replace function public.current_role_name() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.user_roles where user_id = auth.uid()
$$;

-- ----- public registration RPC (anon-callable) -------------------------------
-- Anonymous callers should not have direct write on `registrations`. This
-- function takes the masterclass slug + minimal lead identity, upserts the
-- lead by idempotency_key, and inserts the registration row. SECURITY DEFINER
-- runs as the schema owner so RLS is bypassed inside the function only.
create or replace function public.register_for_masterclass(
  p_masterclass_slug text,
  p_idempotency_key text,
  p_first_name text,
  p_last_name text,
  p_email citext,
  p_school_name text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_mc_id uuid;
  v_program_id uuid;
  v_school_id uuid;
  v_lead_id uuid;
  v_reg_id uuid;
begin
  select id, program_id into v_mc_id, v_program_id
    from public.masterclasses where registration_page_slug = p_masterclass_slug;
  if v_mc_id is null then
    raise exception 'unknown_masterclass';
  end if;

  -- find or create a placeholder school by name (registration may precede scrape)
  select id into v_school_id from public.schools where lower(name) = lower(p_school_name) limit 1;
  if v_school_id is null then
    insert into public.schools (name, country, source, tier_verified)
      values (p_school_name, 'unknown', 'self_register', false)
      returning id into v_school_id;
  end if;

  insert into public.leads (school_id, first_name, last_name, email, idempotency_key, status, source)
    values (v_school_id, p_first_name, p_last_name, p_email, p_idempotency_key, 'registered', 'self_register')
  on conflict (idempotency_key) do update
    set first_name = excluded.first_name,
        last_name  = excluded.last_name,
        status     = case when public.leads.status = 'new' then 'registered' else public.leads.status end
  returning id into v_lead_id;

  insert into public.registrations (lead_id, masterclass_id)
    values (v_lead_id, v_mc_id)
    on conflict (lead_id, masterclass_id) do update set registered_at = now()
    returning id into v_reg_id;

  insert into public.pipeline_events (lead_id, stage, status, payload_json)
    values (v_lead_id, 'invite_send'::public.pipeline_stage, 'success'::public.event_status,
      jsonb_build_object('event','self_registered','masterclass_id', v_mc_id));

  return v_reg_id;
end;
$$;

revoke all on function public.register_for_masterclass(text,text,text,text,citext,text) from public;
grant execute on function public.register_for_masterclass(text,text,text,text,citext,text) to anon, authenticated;

-- ----- funnel view (dashboard reads from here) -------------------------------
create or replace view public.campaign_funnel as
select
  c.id as campaign_id,
  c.name,
  c.program_id,
  c.status,
  c.started_at,
  c.ended_at,
  count(distinct es.lead_id) filter (where es.status <> 'queued') as emails_sent,
  count(distinct es.lead_id) filter (where es.opens > 0)         as opened,
  count(distinct es.lead_id) filter (where es.clicks > 0)        as clicked,
  count(distinct r.lead_id)                                       as registered,
  count(distinct r.lead_id) filter (where r.attended)             as attended,
  count(distinct o.lead_id) filter (where o.status in ('active','paid')) as offered,
  count(distinct p.lead_id) filter (where p.status = 'succeeded') as paid,
  coalesce(sum(p.amount_cents) filter (where p.status = 'succeeded'), 0) as revenue_cents
from public.campaigns c
left join public.email_sends es on es.campaign_id = c.id
left join public.registrations r on r.masterclass_id = c.masterclass_id
  and exists (select 1 from public.email_sends s2 where s2.lead_id = r.lead_id and s2.campaign_id = c.id)
left join public.offers o on o.campaign_id = c.id
left join public.payments p on p.offer_id = o.id
group by c.id;
