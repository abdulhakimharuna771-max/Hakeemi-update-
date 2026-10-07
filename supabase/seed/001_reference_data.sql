-- =============================================================================
-- GIZMO DAN KAITA OFFICE PLUS — Reference data
--
-- Reference rows only: no applicants, no applications, no statistics.
-- Safe to re-run (upserts by code).
--
-- `detail_schema` drives the adaptive Step 4 form. To add a new applicant
-- category later, insert a row here — no frontend change is required, because
-- the form renders whatever descriptors the database provides and both the
-- client and the database validate against the same schema.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Applicant categories
-- ---------------------------------------------------------------------------
insert into public.applicant_categories
  (code, name, short_description, description, icon, form_variant, sort_order, is_active, detail_schema)
values
(
  'STUDENT',
  'Student',
  'Final year and undergraduate students with academic projects or research ideas.',
  'Students developing a final year project, research work or academic innovation who want support to take it beyond the classroom.',
  'graduation-cap',
  'student',
  1,
  true,
  '[
    {"key":"institution","label":"Institution","type":"text","required":true,"placeholder":"e.g. University of Ibadan","help":"The school, college or polytechnic you attend."},
    {"key":"department","label":"Department","type":"text","required":true,"placeholder":"e.g. Computer Science"},
    {"key":"course_of_study","label":"Course of study","type":"text","required":false,"placeholder":"e.g. B.Sc. Computer Science"},
    {"key":"study_level","label":"Level of study","type":"select","required":true,"options":[{"value":"ND","label":"ND"},{"value":"HND","label":"HND"},{"value":"Undergraduate","label":"Undergraduate"},{"value":"Postgraduate","label":"Postgraduate"}]},
    {"key":"fyp_status","label":"Final year project status","type":"select","required":true,"options":[{"value":"Not started","label":"Not started"},{"value":"In progress","label":"In progress"},{"value":"Completed","label":"Completed"},{"value":"Awaiting defence","label":"Awaiting defence"}]}
  ]'::jsonb
),
(
  'BUSINESS_OWNER',
  'Business Owner',
  'Entrepreneurs and small business owners building or growing an enterprise.',
  'Owners of businesses at any stage — from a new venture to an established enterprise — looking for support to grow, formalise or scale.',
  'store',
  'business',
  2,
  true,
  '[
    {"key":"business_name","label":"Business name","type":"text","required":true,"placeholder":"Registered or trading name"},
    {"key":"business_type","label":"Business type","type":"select","required":true,"options":[{"value":"Agriculture & agro-processing","label":"Agriculture & agro-processing"},{"value":"Retail & trade","label":"Retail & trade"},{"value":"Food & beverage","label":"Food & beverage"},{"value":"Fashion & textiles","label":"Fashion & textiles"},{"value":"Manufacturing & fabrication","label":"Manufacturing & fabrication"},{"value":"Technology & digital services","label":"Technology & digital services"},{"value":"Construction","label":"Construction"},{"value":"Transport & logistics","label":"Transport & logistics"},{"value":"Health & wellness","label":"Health & wellness"},{"value":"Education & training","label":"Education & training"},{"value":"Creative & media","label":"Creative & media"},{"value":"Professional services","label":"Professional services"},{"value":"Other","label":"Other"}]},
    {"key":"business_stage","label":"Current stage","type":"select","required":true,"options":[{"value":"Idea stage","label":"Idea stage"},{"value":"Startup","label":"Startup"},{"value":"Growing","label":"Growing"},{"value":"Established","label":"Established"}]},
    {"key":"worker_count","label":"Number of workers","type":"number","required":false,"placeholder":"e.g. 4","help":"Include yourself if you work in the business."},
    {"key":"main_challenge","label":"Main challenge","type":"textarea","required":true,"placeholder":"What is the biggest obstacle to growing this business right now?"}
  ]'::jsonb
),
(
  'FARMER',
  'Farmer',
  'Farmers and agro-entrepreneurs across crop, livestock and value-addition chains.',
  'Farmers and agro-entrepreneurs who want better inputs, equipment, training, markets or value addition for what they produce.',
  'sprout',
  'farmer',
  3,
  true,
  '[
    {"key":"farming_type","label":"Farming type","type":"select","required":true,"options":[{"value":"Crop farming","label":"Crop farming"},{"value":"Livestock","label":"Livestock"},{"value":"Poultry","label":"Poultry"},{"value":"Fisheries / aquaculture","label":"Fisheries / aquaculture"},{"value":"Mixed farming","label":"Mixed farming"},{"value":"Agro-forestry","label":"Agro-forestry"},{"value":"Processing / value addition","label":"Processing / value addition"}]},
    {"key":"main_products","label":"Main products","type":"text","required":true,"placeholder":"e.g. Maize, cassava, tomatoes"},
    {"key":"production_stage","label":"Production stage","type":"select","required":true,"options":[{"value":"Subsistence","label":"Subsistence"},{"value":"Small-scale commercial","label":"Small-scale commercial"},{"value":"Commercial","label":"Commercial"},{"value":"Scaling / expansion","label":"Scaling / expansion"}]},
    {"key":"main_challenge","label":"Main challenge","type":"textarea","required":true,"placeholder":"e.g. Storage losses, access to improved seedlings, irrigation"}
  ]'::jsonb
),
(
  'PROFESSIONAL',
  'Professional',
  'Practitioners and skilled workers seeking development, mentorship and opportunity.',
  'Working professionals and skilled practitioners who want to deepen their expertise, gain mentorship or connect with industry opportunities.',
  'briefcase',
  'professional',
  4,
  true,
  '[
    {"key":"profession","label":"Profession","type":"text","required":true,"placeholder":"e.g. Civil engineer, teacher, nurse, accountant"},
    {"key":"skills","label":"Key skills","type":"text","required":true,"placeholder":"e.g. Project management, data analysis, electrical installation"},
    {"key":"years_experience","label":"Years of experience","type":"select","required":true,"options":[{"value":"Less than 1 year","label":"Less than 1 year"},{"value":"1 - 3 years","label":"1 - 3 years"},{"value":"4 - 7 years","label":"4 - 7 years"},{"value":"8 - 15 years","label":"8 - 15 years"},{"value":"Over 15 years","label":"Over 15 years"}]},
    {"key":"development_goals","label":"Development goals","type":"textarea","required":true,"placeholder":"What do you want to achieve through this program?"}
  ]'::jsonb
),
(
  'INNOVATOR',
  'Innovator',
  'Innovators and builders with a solution, prototype or early-stage idea.',
  'Innovators with an idea, prototype or early-stage solution that addresses a real problem in their community or industry.',
  'lightbulb',
  'innovator',
  5,
  true,
  '[
    {"key":"innovation_name","label":"Innovation name","type":"text","required":true,"placeholder":"What is your innovation called?"},
    {"key":"problem_solved","label":"Problem being solved","type":"textarea","required":true,"placeholder":"Which specific problem does this innovation address?"},
    {"key":"prototype_status","label":"Current status","type":"select","required":true,"options":[{"value":"Concept only","label":"Concept only"},{"value":"Prototype in development","label":"Prototype in development"},{"value":"Working prototype","label":"Working prototype"},{"value":"Tested with users","label":"Tested with users"},{"value":"Market-ready","label":"Market-ready"}]},
    {"key":"innovation_description","label":"Innovation description","type":"textarea","required":true,"placeholder":"Describe how it works and what makes it different."}
  ]'::jsonb
)
on conflict (code) do update set
  name              = excluded.name,
  short_description = excluded.short_description,
  description       = excluded.description,
  icon              = excluded.icon,
  form_variant      = excluded.form_variant,
  sort_order        = excluded.sort_order,
  is_active         = excluded.is_active,
  detail_schema     = excluded.detail_schema;

-- ---------------------------------------------------------------------------
-- Support needs (Step 5)
-- ---------------------------------------------------------------------------
insert into public.support_needs (code, name, description, requires_details, sort_order, is_active)
values
  ('TRAINING',            'Training',             'Structured training relevant to your field or idea.',            false, 1,  true),
  ('MENTORSHIP',          'Mentorship',           'Guidance from an experienced mentor.',                          false, 2,  true),
  ('FUNDING',             'Funding',              'Financial support, grants or investment readiness.',            false, 3,  true),
  ('EQUIPMENT',           'Equipment',            'Tools, machinery or hardware needed to operate.',               false, 4,  true),
  ('TECHNOLOGY',          'Technology',           'Software, digital tools, platforms or technical systems.',      false, 5,  true),
  ('MARKET_ACCESS',       'Market Access',        'Routes to customers, buyers, off-takers or distribution.',       false, 6,  true),
  ('PARTNERSHIP',         'Partnership',          'Collaboration with organisations, institutions or industry.',   false, 7,  true),
  ('BUSINESS_DEVELOPMENT','Business Development', 'Support with planning, formalisation, operations or finance.',   false, 8,  true),
  ('CAREER_DEVELOPMENT',  'Career Development',   'Career guidance, placement or professional growth.',            false, 9,  true),
  ('DIGITAL_SKILLS',      'Digital Skills',       'Practical digital and technology skills training.',             false, 10, true),
  ('OTHER',               'Other',                'Something not listed above.',                                   true,  11, true)
on conflict (code) do update set
  name             = excluded.name,
  description      = excluded.description,
  requires_details = excluded.requires_details,
  sort_order       = excluded.sort_order,
  is_active        = excluded.is_active;

-- ---------------------------------------------------------------------------
-- Document types (Step 6)
--
-- All optional in Phase 1: a reviewer can request specific documents later
-- through the "more information required" workflow rather than blocking
-- submission up front.
-- ---------------------------------------------------------------------------
insert into public.document_types
  (code, name, description, is_required, applies_to_categories, max_size_mb, sort_order, is_active)
values
  ('IDENTIFICATION', 'Identification document',
   'NIN slip, voter''s card, driver''s licence or international passport.',
   false, null, 5, 1, true),
  ('STUDENT_ID', 'Student ID or admission letter',
   'Proof of current enrolment at your institution.',
   false, array['STUDENT'], 5, 2, true),
  ('PROJECT_DOCUMENT', 'Project or proposal document',
   'Your final year project write-up, proposal or project documentation.',
   false, array['STUDENT', 'INNOVATOR'], 5, 3, true),
  ('BUSINESS_DOCUMENT', 'Business document',
   'Business registration, plan, or financial summary.',
   false, array['BUSINESS_OWNER'], 5, 4, true),
  ('FARM_RECORDS', 'Farm or produce records',
   'Records, photographs or documentation of your farming activity.',
   false, array['FARMER'], 5, 5, true),
  ('PROFESSIONAL_CV', 'CV or professional profile',
   'Your curriculum vitae or professional portfolio.',
   false, array['PROFESSIONAL'], 5, 6, true),
  ('SUPPORTING_FILE', 'Other supporting file',
   'Any additional file that supports your application.',
   false, null, 5, 7, true)
on conflict (code) do update set
  name                  = excluded.name,
  description           = excluded.description,
  is_required           = excluded.is_required,
  applies_to_categories = excluded.applies_to_categories,
  max_size_mb           = excluded.max_size_mb,
  sort_order            = excluded.sort_order,
  is_active             = excluded.is_active;

-- ---------------------------------------------------------------------------
-- Program
--
-- Opens/closes timestamps are intentionally NULL (open-ended) — set real dates
-- from the future Patron Dashboard when an intake window is decided.
-- ---------------------------------------------------------------------------
insert into public.programs (code, name, summary, description, status, focus_areas, is_active)
values (
  'FYPIDP',
  'Final Year Project & Innovation Development Program',
  'A digital platform connecting education, technology, innovation, entrepreneurship and community development.',
  'The Final Year Project & Innovation Development Program identifies students, youth, entrepreneurs, farmers, professionals and innovators; collects their information and ideas; and connects them to development programs, training, mentorship and opportunities.',
  'OPEN',
  array[
    'Education',
    'Technology',
    'Innovation',
    'Industry',
    'Entrepreneurship',
    'Community Development',
    'Youth Development',
    'Digital Skills',
    'Business Opportunities'
  ],
  true
)
on conflict (code) do update set
  name        = excluded.name,
  summary     = excluded.summary,
  description = excluded.description,
  status      = excluded.status,
  focus_areas = excluded.focus_areas,
  is_active   = excluded.is_active;

-- ---------------------------------------------------------------------------
-- Application status reference (labels, ordering, UI tone)
-- ---------------------------------------------------------------------------
insert into public.application_statuses
  (code, label, description, sort_order, tone, visible_to_applicant, is_terminal, is_initial)
values
  ('DRAFT', 'Draft',
   'Started but not yet submitted. Only visible to you.',
   0, 'neutral', false, false, true),
  ('SUBMITTED', 'Submitted',
   'Received and awaiting review.',
   1, 'info', true, false, false),
  ('UNDER_REVIEW', 'Under Review',
   'Being assessed by the review team.',
   2, 'progress', true, false, false),
  ('MORE_INFORMATION_REQUIRED', 'More Information Required',
   'Additional information or documents are needed from you.',
   3, 'warning', true, false, false),
  ('SHORTLISTED', 'Shortlisted',
   'Selected for the next stage of the program.',
   4, 'success', true, false, false),
  ('APPROVED', 'Approved',
   'Approved for the program.',
   5, 'success', true, false, false),
  ('REJECTED', 'Rejected',
   'Not selected in this cycle.',
   6, 'danger', true, true, false),
  ('IN_DEVELOPMENT', 'In Development',
   'Actively being supported through training, mentorship or project development.',
   7, 'progress', true, false, false),
  ('COMPLETED', 'Completed',
   'Program activities completed.',
   8, 'success', true, true, false)
on conflict (code) do update set
  label                = excluded.label,
  description          = excluded.description,
  sort_order           = excluded.sort_order,
  tone                 = excluded.tone,
  visible_to_applicant = excluded.visible_to_applicant,
  is_terminal          = excluded.is_terminal,
  is_initial           = excluded.is_initial;
