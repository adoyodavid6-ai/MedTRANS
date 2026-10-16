-- DoctorCare reference data. Inactive / unreviewed until confirmed (see docs/SETUP-CHECKLIST.md).

-- The first fully specified service (§2.3 "prove one"). Inactive until fees, coverage and clinical governance are confirmed.
insert into public.care_services (slug, name, summary, description, required_profession, duration_minutes, eligibility_notes, escalation_notes)
values (
  'gp-home-visit',
  'GP home visit',
  'A registered doctor visits you at home to assess a non-emergency health concern.',
  'A verified, registered doctor comes to your home to listen, examine, and advise. They can treat what is safe to treat at home, write a prescription where appropriate, and refer you on if you need tests or hospital care. You receive a visit summary afterwards.',
  'doctor',
  60,
  'For non-emergency concerns in adults and children where travelling is difficult or you prefer care at home. Not for emergencies. [[CONFIRM: clinical eligibility criteria]]',
  'The doctor will stop and arrange emergency care if they find signs of a serious condition. [[CONFIRM: clinical escalation protocol]]'
);

-- Draft urgent-symptom screening. NOT clinically reviewed: bookings stay blocked until a named
-- clinician reviews and approves this set. [[CONFIRM: clinical review of screening questions]]
insert into public.care_screening_questions (position, question, is_red_flag) values
  (1, 'Is the person struggling to breathe, or breathing very fast or noisily?', true),
  (2, 'Do they have chest pain, pressure or tightness?', true),
  (3, 'Are they unconscious, very drowsy, confused, or hard to wake?', true),
  (4, 'Is there heavy bleeding that will not stop?', true),
  (5, 'Is their face drooping, an arm weak, or their speech slurred, starting suddenly?', true),
  (6, 'Are they having a fit (seizure) now, or have they just had one for the first time?', true),
  (7, 'Is there swelling of the face, lips, tongue or throat, or a severe allergic reaction?', true),
  (8, 'Are they pregnant with heavy bleeding, severe tummy pain, or fits?', true),
  (9, 'Are they thinking about harming themselves or someone else right now?', true);

insert into public.platform_settings (key, value, description, is_public) values
  ('doctorcare.offer_timeout_minutes', '10', 'Minutes a professional has to accept before the next suitable one is asked. [[CONFIRM: match offer timeout]]', true)
on conflict (key) do nothing;
