-- =============================================================================
-- LWL pipeline — Phase 1 seed
-- Inserts the FDF program, its target roles, tier rules, and starter templates.
-- Idempotent on slug / kind. Safe to re-run.
-- =============================================================================

-- ----- FDF program -----------------------------------------------------------
insert into public.programs (slug, name, standard_price_cents, offer_price_cents, offer_window_hours, status)
values ('fdf', 'Future Doctors Fellowship', 85000, 40000, 72, 'active')
on conflict (slug) do update set
  name = excluded.name,
  standard_price_cents = excluded.standard_price_cents,
  offer_price_cents = excluded.offer_price_cents,
  offer_window_hours = excluded.offer_window_hours,
  status = excluded.status;

-- ----- target roles ----------------------------------------------------------
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

-- ----- tier rules ------------------------------------------------------------
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

-- ----- starter email templates (placeholder copy; refine in Phase 3) ---------
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
