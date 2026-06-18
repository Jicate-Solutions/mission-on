-- =============================================================================
-- Mission ON — Smart Choices
-- 0004_seed.sql — Program config + questionnaire template v1.
-- APPLY LAST. Idempotent inserts (on conflict do nothing / upsert).
-- No user/auth rows are seeded here (those come from Supabase Auth + role
-- allocation by an admin). Nothing in this file references auth.users.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- program_config singleton.
-- -----------------------------------------------------------------------------
insert into program_config (
  id, program_name, active_template_version, fee_threshold_inr,
  follow_up_window_days, data_retention_days, safeguarding_contacts, settings
) values (
  1,
  'Mission ON — Smart Choices',
  1,
  100000,                              -- ₹1,00,000 fee threshold (A1 vs A2)
  10,                                  -- follow-up window (~1 week / 10 days)
  null,                                -- retention period: pending Yi/JKKN sign-off (§16)
  '[]'::jsonb,                         -- safeguarding contacts: pending sign-off (§16)
  jsonb_build_object(
    'divergence_step_threshold', 1,    -- flag when A demographic vs behaviour diverge > 1
    'anonymous_chat_mode', 'global',   -- single global space (default; pending §16)
    'languages', jsonb_build_array('en', 'ta')
  )
)
on conflict (id) do update set
  active_template_version = excluded.active_template_version,
  fee_threshold_inr       = excluded.fee_threshold_inr,
  follow_up_window_days   = excluded.follow_up_window_days,
  settings                = excluded.settings;

-- -----------------------------------------------------------------------------
-- questionnaire_templates v1.
-- Each question is tagged with a category:
--   A_demographic -> resolves A1/A2/A3 (fee bracket + school type; AUTHORITATIVE)
--   A_behaviour   -> behavioural pattern signal reconciled against demographic;
--                    divergence > 1 step flags the school for Admin confirmation
--   B             -> resolves B1/B2/B3 (usage reality)
-- Options carry a `weight` (contribution) and, where relevant, the `code` they
-- nudge toward. The authoritative scoring engine lives in the app DAL; this
-- jsonb is the data the engine reads.
-- -----------------------------------------------------------------------------
insert into questionnaire_templates (version, title, questions, is_active)
values (
  1,
  'Mission ON Pre-Session Questionnaire v1',
  jsonb_build_array(
    -- ---- Category A — Demographic (fee + type; authoritative for A1/A2/A3) ----
    jsonb_build_object(
      'id', 'a_dem_school_type',
      'category', 'A_demographic',
      'text', 'Is this a government or private school?',
      'options', jsonb_build_array(
        jsonb_build_object('value', 'private',    'label', 'Private',    'weight', 0),
        jsonb_build_object('value', 'government', 'label', 'Government', 'weight', 0, 'code', 'A3')
      )
    ),
    jsonb_build_object(
      'id', 'a_dem_fee_bracket',
      'category', 'A_demographic',
      'text', 'For private schools, what is the approximate annual fee per Learner?',
      'options', jsonb_build_array(
        jsonb_build_object('value', 'fee_above_1l', 'label', 'Above ₹1,00,000 / year', 'weight', 0, 'code', 'A1'),
        jsonb_build_object('value', 'fee_below_1l', 'label', 'Below ₹1,00,000 / year', 'weight', 0, 'code', 'A2'),
        jsonb_build_object('value', 'na',           'label', 'Not applicable (government school)', 'weight', 0, 'code', 'A3')
      )
    ),

    -- ---- Category A — Behaviour (pattern signal; reconciled vs demographic) ----
    jsonb_build_object(
      'id', 'a_beh_resource_access',
      'category', 'A_behaviour',
      'text', 'How would you describe Learners'' access to disposable money / private spaces?',
      'options', jsonb_build_array(
        jsonb_build_object('value', 'high',   'label', 'High',     'weight', 0, 'code', 'A1'),
        jsonb_build_object('value', 'medium', 'label', 'Moderate', 'weight', 0, 'code', 'A2'),
        jsonb_build_object('value', 'low',    'label', 'Low',      'weight', 0, 'code', 'A3')
      )
    ),
    jsonb_build_object(
      'id', 'a_beh_environment',
      'category', 'A_behaviour',
      'text', 'How exposed is the surrounding environment to substance availability?',
      'options', jsonb_build_array(
        jsonb_build_object('value', 'sheltered', 'label', 'Largely sheltered', 'weight', 0, 'code', 'A1'),
        jsonb_build_object('value', 'mixed',     'label', 'Mixed',             'weight', 0, 'code', 'A2'),
        jsonb_build_object('value', 'exposed',   'label', 'Highly exposed',    'weight', 0, 'code', 'A3')
      )
    ),

    -- ---- Category B — Usage reality (resolves B1/B2/B3) ----
    jsonb_build_object(
      'id', 'b_usage_prevalence',
      'category', 'B',
      'text', 'What best describes substance use among Learners in this cohort?',
      'options', jsonb_build_array(
        jsonb_build_object('value', 'none',      'label', 'No usage — aware and afraid to take it up',            'weight', 1, 'code', 'B1'),
        jsonb_build_object('value', 'mild',      'label', 'Mild — curiosity-driven / peer-pressure-driven',       'weight', 1, 'code', 'B2'),
        jsonb_build_object('value', 'frequent',  'label', 'Frequent users, some actively influencing others',     'weight', 1, 'code', 'B3')
      )
    ),
    jsonb_build_object(
      'id', 'b_peer_influence',
      'category', 'B',
      'text', 'Is there evidence of Learners influencing peers toward use?',
      'options', jsonb_build_array(
        jsonb_build_object('value', 'no',        'label', 'No / not observed',                 'weight', 1, 'code', 'B1'),
        jsonb_build_object('value', 'some',      'label', 'Some peer pressure / curiosity',     'weight', 1, 'code', 'B2'),
        jsonb_build_object('value', 'active',    'label', 'Active influencing / "polluting"',   'weight', 1, 'code', 'B3')
      )
    ),
    jsonb_build_object(
      'id', 'b_attitude',
      'category', 'B',
      'text', 'What is the prevailing attitude toward substances in this cohort?',
      'options', jsonb_build_array(
        jsonb_build_object('value', 'fearful',   'label', 'Fearful / strongly avoidant',       'weight', 1, 'code', 'B1'),
        jsonb_build_object('value', 'curious',   'label', 'Curious / experimental',            'weight', 1, 'code', 'B2'),
        jsonb_build_object('value', 'normalised','label', 'Normalised / habitual',             'weight', 1, 'code', 'B3')
      )
    )
  ),
  true
)
on conflict (version) do nothing;
