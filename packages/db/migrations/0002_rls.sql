-- =============================================================================
-- LWL pipeline — Row Level Security policies (Phase 1)
-- Supabase service_role bypasses RLS automatically — n8n uses the service key.
-- The admin Next.js app uses the user's JWT and is constrained by these policies.
-- =============================================================================

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

-- Helper macro: admin/operator can read+write; viewer can read.
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

-- leads + offers + payments hold PII / money. Admin+operator full; viewer
-- gets aggregate-only access through the campaign_funnel view (which queries
-- with security_definer = false so RLS still applies on base tables; here we
-- give viewer SELECT on the safe columns by allowing select but the admin app
-- must project only safe columns).
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
-- Payments are written by service-role only (n8n stripe webhook handler).

-- user_roles: admins can manage. Self can read own row.
drop policy if exists user_roles_self_select on public.user_roles;
create policy user_roles_self_select on public.user_roles
  for select to authenticated using (user_id = auth.uid());
drop policy if exists user_roles_admin_all on public.user_roles;
create policy user_roles_admin_all on public.user_roles
  for all to authenticated
  using (public.current_role_name() = 'admin')
  with check (public.current_role_name() = 'admin');

-- audit_log: admin read; nobody writes from JWT (service-role only).
drop policy if exists audit_log_admin_select on public.audit_log;
create policy audit_log_admin_select on public.audit_log
  for select to authenticated using (public.current_role_name() = 'admin');

-- Public anon: no policies on any base table => default deny.
-- Public anon CAN call register_for_masterclass() (granted in 0001_init.sql).
