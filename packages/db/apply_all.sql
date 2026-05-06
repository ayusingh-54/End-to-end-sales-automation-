-- =============================================================================
-- LWL FDF — APPLY ALL: schema + RLS + seed + grant admin role
-- Single-file paste into Supabase SQL Editor. Idempotent — safe to re-run.
-- =============================================================================

-- ============================================================================
-- BLOCK 1: schema (extensions, helpers, enums, tables, indexes, RPC, view)
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

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

create table if not exists public.target_roles (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  role_title text not null,
  synonyms text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (program_id, role_title)
);
create index if not exists target_roles_program_idx on public.target_roles(program_id);

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

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_user_roles_updated on public.user_roles;
create trigger trg_user_roles_updated before update on public.user_roles
  for each row execute function public.set_updated_at();

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

create or replace function public.current_role_name() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.user_roles where user_id = auth.uid()
$$;

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

create or replace view public.campaign_funnel
  with (security_invoker = on)
as
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

-- ============================================================================
-- BLOCK 2: Row Level Security policies
-- ============================================================================

alter table public.programs           enable row level security;
alter table public.masterclasses      enable row level security;
alter table public.target_roles       enable row level security;
alter table public.school_tier_rules  enable row level security;
alter table public.schools            enable row level security;
alter table public.schools_raw        enable row level security;
alter table public.leads              enable row level security;
alter table public.campaigns          enable row level security;
alter table public.email_templates    enable row level security;
alter table public.email_sends        enable row level security;
alter table public.registrations      enable row level security;
alter table public.offers             enable row level security;
alter table public.payments           enable row level security;
alter table public.pipeline_events    enable row level security;
alter table public.user_roles         enable row level security;
alter table public.audit_log          enable row level security;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'programs','masterclasses','target_roles','school_tier_rules',
      'schools','schools_raw','campaigns','email_templates',
      'email_sends','registrations','pipeline_events'
    ])
  loop
    execute format($f$
      drop policy if exists %1$I_admin_all on public.%1$I;
      create policy %1$I_admin_all on public.%1$I
        for all to authenticated
        using (public.current_role_name() in ('admin','operator'))
        with check (public.current_role_name() in ('admin','operator'));

      drop policy if exists %1$I_viewer_select on public.%1$I;
      create policy %1$I_viewer_select on public.%1$I
        for select to authenticated
        using (public.current_role_name() = 'viewer');
    $f$, t);
  end loop;
end $$;

drop policy if exists leads_admin_all on public.leads;
create policy leads_admin_all on public.leads
  for all to authenticated
  using (public.current_role_name() in ('admin','operator'))
  with check (public.current_role_name() in ('admin','operator'));
drop policy if exists leads_viewer_select on public.leads;
create policy leads_viewer_select on public.leads
  for select to authenticated
  using (public.current_role_name() = 'viewer');

drop policy if exists offers_admin_all on public.offers;
create policy offers_admin_all on public.offers
  for all to authenticated
  using (public.current_role_name() in ('admin','operator'))
  with check (public.current_role_name() in ('admin','operator'));

drop policy if exists payments_admin_select on public.payments;
create policy payments_admin_select on public.payments
  for select to authenticated
  using (public.current_role_name() in ('admin','operator'));

drop policy if exists user_roles_self_select on public.user_roles;
create policy user_roles_self_select on public.user_roles
  for select to authenticated using (user_id = auth.uid());
drop policy if exists user_roles_admin_all on public.user_roles;
create policy user_roles_admin_all on public.user_roles
  for all to authenticated
  using (public.current_role_name() = 'admin')
  with check (public.current_role_name() = 'admin');

drop policy if exists audit_log_admin_select on public.audit_log;
create policy audit_log_admin_select on public.audit_log
  for select to authenticated using (public.current_role_name() = 'admin');

-- ============================================================================
-- BLOCK 3: Seed FDF program + 7 target roles + tier rules + 12 templates
-- ============================================================================

insert into public.programs (slug, name, standard_price_cents, offer_price_cents, offer_window_hours, status)
values ('fdf', 'Future Doctors Fellowship', 85000, 40000, 72, 'active')
on conflict (slug) do update set
  name = excluded.name,
  standard_price_cents = excluded.standard_price_cents,
  offer_price_cents = excluded.offer_price_cents,
  offer_window_hours = excluded.offer_window_hours,
  status = excluded.status;

with prog as (select id from public.programs where slug = 'fdf')
insert into public.target_roles (program_id, role_title, synonyms)
select prog.id, role, syn from prog,
  (values
    ('Pre-Med Advisor',          array['Premed Advisor','Pre-Medical Advisor','Health Professions Advisor']),
    ('Science Department Head',  array['Head of Science','Science Chair','Department Chair, Science']),
    ('Biology Teacher',          array['AP Biology Teacher','Biology Instructor','Life Sciences Teacher']),
    ('Counselor',                array['School Counselor','Guidance Counselor']),
    ('Head of School',           array['Headmaster','Headmistress','Principal','Director of School']),
    ('College Counselor',        array['Director of College Counseling','College Advisor','University Counselor']),
    ('CAS Coordinator',          array['CAS Advisor','Creativity Activity Service Coordinator'])
  ) as r(role, syn)
on conflict (program_id, role_title) do update set synonyms = excluded.synonyms;

with prog as (select id from public.programs where slug = 'fdf')
insert into public.school_tier_rules
  (program_id, min_tuition_usd, country, school_types, exclude_types, scoring_weights, threshold_score)
select prog.id, 40000, 'US',
  array['private','boarding','independent','elite_day'],
  array['public','charter','community','for_profit_only'],
  jsonb_build_object(
    'tuition_40k', 35,
    'tuition_60k', 15,
    'nais_member', 15,
    'tabs_member', 10,
    'ssatb_accepted', 5,
    'boarding_offered', 10,
    'top5_matriculation', 10,
    'endowment_50m', 5,
    'class_size_15_or_less', 5
  ),
  70
from prog
on conflict do nothing;

with prog as (select id from public.programs where slug = 'fdf')
insert into public.email_templates (program_id, kind, subject, body_md, variables)
select prog.id, k, s, b, v from prog,
  (values
    ('invite'::public.email_template_kind,
     'A free 60-min session for {{first_name}}''s premed-bound students',
     E'Hi {{first_name}},\n\nI run Learn with Leaders'' Future Doctors Fellowship — a small, mentor-led programme for high-school students serious about medicine.\n\nWe''re hosting a free 60-min masterclass on **{{masterclass_topic}}** with {{mentor_name}}. It''s the kind of session your premed-bound students at {{school}} will get a lot from.\n\nReserve a seat for them: {{registration_link}}\n\nHappy to share the curriculum if useful.\n\n— Gunjan, Learn with Leaders',
     array['first_name','school','masterclass_topic','mentor_name','registration_link']),
    ('reminder_24h'::public.email_template_kind,
     'Tomorrow: {{masterclass_topic}} with {{mentor_name}}',
     E'Hi {{first_name}},\n\nQuick reminder — tomorrow''s session on **{{masterclass_topic}}** runs at {{masterclass_time}}.\n\nJoin link: {{zoom_join_url}}\n\nSee you then.\n\n— LWL',
     array['first_name','masterclass_topic','mentor_name','masterclass_time','zoom_join_url']),
    ('reminder_1h'::public.email_template_kind,
     'Starting in 1 hour: {{masterclass_topic}}',
     E'Hi {{first_name}},\n\nWe go live in an hour. {{zoom_join_url}}\n\n— LWL',
     array['first_name','masterclass_topic','zoom_join_url']),
    ('offer_d0'::public.email_template_kind,
     'Your FDF seat at {{offer_price}} (next 72 hours)',
     E'Hi {{first_name}},\n\nThanks for joining today''s session. As promised, FDF — normally {{standard_price}} — is **{{offer_price}}** for the next 72 hours for masterclass attendees.\n\nWhat''s included: 1:1 mentor matching, interview practice, application support, and a doctor-led curriculum your students won''t get anywhere else.\n\nReserve: {{checkout_url}}\n\nOffer expires {{expires_at}}.\n\n— Gunjan',
     array['first_name','standard_price','offer_price','checkout_url','expires_at']),
    ('offer_d1'::public.email_template_kind,
     'What FDF parents say after one cycle',
     E'Hi {{first_name}},\n\nA short note from a parent whose daughter went through FDF last cohort:\n\n> "She walked into her interviews like she''d been doing them for years."\n\nIf that''s the kind of outcome you want for your students, the {{offer_price}} window is open until {{expires_at}}.\n\n{{checkout_url}}\n\n— LWL',
     array['first_name','offer_price','expires_at','checkout_url']),
    ('offer_d2_morning'::public.email_template_kind,
     'Last day: FDF at {{offer_price}}',
     E'Hi {{first_name}},\n\nQuick heads-up — the masterclass-attendee price ({{offer_price}}) ends tonight at {{expires_at}}. After that, FDF returns to {{standard_price}}.\n\n{{checkout_url}}\n\n— LWL',
     array['first_name','offer_price','standard_price','expires_at','checkout_url']),
    ('offer_d2_final'::public.email_template_kind,
     'Closing in 4 hours',
     E'Hi {{first_name}},\n\nFour hours left on the {{offer_price}} price.\n\n{{checkout_url}}\n\n— LWL',
     array['first_name','offer_price','checkout_url']),
    ('noshow'::public.email_template_kind,
     'You missed it — here''s the recording (and the same offer)',
     E'Hi {{first_name}},\n\nWe missed you at the FDF masterclass. The recording is here: {{recording_url}}\n\nThe attendee offer (FDF at {{offer_price}}, normally {{standard_price}}) is open to you for the next 72 hours.\n\n{{checkout_url}}\n\n— LWL',
     array['first_name','recording_url','offer_price','standard_price','checkout_url']),
    ('reengage'::public.email_template_kind,
     'New angle on FDF — different fit?',
     E'Hi {{first_name}},\n\nWe ran a session a couple of weeks ago you may have skipped. Since then, a few things have changed about FDF — most usefully, we now run interview-practice clinics with a current resident every month.\n\nNext cohort starts {{next_cohort_date}}. {{next_masterclass_link}}\n\n— LWL',
     array['first_name','next_cohort_date','next_masterclass_link']),
    ('registration_confirmation'::public.email_template_kind,
     'You''re in: {{masterclass_topic}} with {{mentor_name}}',
     E'Hi {{first_name}},\n\nYou''re registered for **{{masterclass_topic}}** on {{masterclass_time}}.\n\nJoin link: {{zoom_join_url}}\nCalendar: {{ics_url}}\n\nSee you then.\n\n— LWL',
     array['first_name','masterclass_topic','mentor_name','masterclass_time','zoom_join_url','ics_url']),
    ('payment_receipt'::public.email_template_kind,
     'Welcome to the Future Doctors Fellowship',
     E'Hi {{first_name}},\n\nYour FDF seat is confirmed. Receipt: {{receipt_url}}\n\nNext steps land in your inbox shortly.\n\n— Gunjan',
     array['first_name','receipt_url']),
    ('resource_delivery'::public.email_template_kind,
     'Your FDF interview-practice pack',
     E'Hi {{first_name}},\n\nLink to your interview-practice pack (expires in 7 days for security): {{resource_url}}\n\n— LWL',
     array['first_name','resource_url'])
  ) as t(k,s,b,v)
on conflict (program_id, kind) do update set
  subject = excluded.subject,
  body_md = excluded.body_md,
  variables = excluded.variables;

-- ============================================================================
-- BLOCK 4: Grant admin role to hello@lwl.com
-- (must already exist in Auth → Users; if not, create that user first)
-- ============================================================================

insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role
from auth.users
where email = 'hello@lwl.com'
on conflict (user_id) do update set role = 'admin';

-- Verification — should return 1 row: hello@lwl.com | admin
select au.email, ur.role, ur.created_at
from public.user_roles ur
join auth.users au on au.id = ur.user_id;
