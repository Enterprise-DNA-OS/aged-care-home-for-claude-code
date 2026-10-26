-- Demo data: Harbourlight Care, a made-up provider with three small homes: Wattle Grove in
-- Penrith (NSW), Banksia House in Geelong (VIC) and Kōwhai Gardens in Christchurch (NZ).
-- Dates are relative to today. Every insert skips what is already there, so re-running is harmless.
--
-- Planted on purpose, so /attention and /compliance have something to say:
--   a Priority 1 SIRS incident (resident to resident force, needs treatment) 30 hours since aware, not reported
--   a Priority 2 SIRS incident (a staff member shouting at a resident) 34 days since aware, not reported, no open disclosure
--   an antipsychotic given as a chemical restraint with no informed consent recorded
--   a lap belt whose behaviour support plan review is overdue
--   a night at Banksia House with no registered nurse on site (23:30 to 07:00)
--   Banksia House under its care minutes target
--   a registered nurse rostered with an expired registration, a carer whose police check has expired
--   Banksia House with no quality indicator submission for last quarter
--   a resident who has lost 6.4% of her weight in three months, every month lower than the last
--   a resident with three falls in 90 days, one needing treatment
--   a stage 2 pressure injury acquired in the home with its dressing overdue
--   in New Zealand: a resident 30 days in with no interRAI and no long-term care plan, an interRAI seven
--   months old, and a stage 3 pressure injury that needs a Section 31 notification and has none

-- ---------------------------------------------------------------- homes

insert into homes (code, name, address, jurisdiction, beds, care_minutes_target, rn_minutes_target, manager) values
  ('WATTLE', 'Wattle Grove', '12 Coral Tree Avenue, Penrith NSW 2750', 'NSW', 14, 212.0, 43.0, 'Anika Lal'),
  ('BANKSIA', 'Banksia House', '48 Pakington Street, Geelong West VIC 3218', 'VIC', 12, 218.0, 44.5, 'Kirsten Vaughan'),
  ('KOWHAI', 'Kōwhai Gardens', '7 Fendalton Road, Christchurch 8014', 'NZ', 10, null, null, 'Quinn Barrett')
on conflict (code) do nothing;

-- ---------------------------------------------------------------- staff

insert into staff (code, full_name, role, home_id, registration_no, registration_expires_on, screening_expires_on, interrai_trained, started_on, left_on)
select s.code, s.full_name, s.role, h.id, s.reg, current_date + s.reg_days, current_date + s.screen_days, s.interrai, current_date - s.tenure, case when s.left_days is null then null else current_date - s.left_days end
from (values
  ('AL', 'Anika Lal', 'RN', 'WATTLE', 'NMW0001234567', 220, 600, false, 2100, null::int),
  ('BT', 'Ben Tran', 'RN', 'WATTLE', 'NMW0002345678', 220, 410, false, 900, null),
  ('CW', 'Chloe Whitaker', 'RN', 'WATTLE', 'NMW0003456789', 45, 380, false, 640, null),
  ('DN', 'Daniel Nwosu', 'RN', 'WATTLE', 'NMW0004567890', 220, 700, false, 1500, null),
  ('EM', 'Elena Moretti', 'EN', 'WATTLE', 'NMW0005678901', 220, 520, false, 800, null),
  ('FP', 'Faith Pillay', 'PCW', 'WATTLE', null, null, 300, false, 400, null),
  ('GR', 'Grace Rangi', 'PCW', 'WATTLE', null, null, 250, false, 700, null),
  ('HS', 'Hamid Sultani', 'PCW', 'WATTLE', null, null, 640, false, 300, null),
  ('KV', 'Kirsten Vaughan', 'RN', 'BANKSIA', 'NMW0006789012', 220, 450, false, 1900, null),
  ('LW', 'Liam Walsh', 'RN', 'BANKSIA', 'NMW0007890123', 220, 330, false, 500, null),
  ('MX', 'Mei Xu', 'RN', 'BANKSIA', 'NMW0008901234', -10, 480, false, 420, null),
  ('NY', 'Nadia Yilmaz', 'PCW', 'BANKSIA', null, null, 360, false, 610, null),
  ('OP', 'Oscar Price', 'PCW', 'BANKSIA', null, null, 200, false, 150, 30),
  ('QB', 'Quinn Barrett', 'RN', 'KOWHAI', 'NCNZ-284113', 158, 30, true, 2400, null),
  ('RC', 'Rawiri Cooper', 'RN', 'KOWHAI', 'NCNZ-301975', 158, 540, true, 980, null),
  ('UH', 'Ula Hemara', 'RN', 'KOWHAI', 'NCNZ-317402', 158, 610, false, 340, null),
  ('SD', 'Sione Fifita', 'HCA', 'KOWHAI', null, null, -5, false, 700, null),
  ('TE', 'Tessa Evans', 'HCA', 'KOWHAI', null, null, 420, false, 260, null)
) as s(code, full_name, role, home, reg, reg_days, screen_days, interrai, tenure, left_days)
join homes h on h.code = s.home
on conflict (code) do nothing;

-- ---------------------------------------------------------------- residents

insert into residents (home_id, code, first_name, last_name, born_on, room, admitted_on, status, left_on, care_level, gp, representative, representative_email,
  statement_to_representative, advance_care_plan, regular_medicines, antipsychotic, alerts)
select h.id, r.code, r.first_name, r.last_name, r.born_on::date, r.room, current_date - r.days_in, r.status,
  case when r.left_days is null then null else current_date - r.left_days end,
  r.level, r.gp, r.rep, r.rep_email, r.to_rep, r.acp, r.meds, r.antipsychotic, r.alerts
from (values
  ('W01', 'Joan', 'Whitfield', '1938-04-11', '1', 1460, 'permanent', null::int, 'AN-ACC class 8', 'Dr S. Raman', 'Paul Whitfield (son)', 'paul.whitfield@example.com', true, true, 7, false, null),
  ('W02', 'Stavros', 'Pappas', '1941-09-02', '2', 900, 'permanent', null, 'AN-ACC class 6', 'Dr S. Raman', 'Eleni Pappas (daughter)', 'eleni.pappas@example.com', true, true, 10, false, 'Thickened fluids, level 2'),
  ('W03', 'Margaret', 'Doyle', '1935-12-19', '3', 620, 'permanent', null, 'AN-ACC class 9', 'Dr M. Okafor', 'Fiona Doyle (daughter)', 'fiona.doyle@example.com', true, false, 8, false, 'Weigh weekly'),
  ('W04', 'Bill', 'Henderson', '1944-06-30', '4', 410, 'permanent', null, 'AN-ACC class 5', 'Dr M. Okafor', 'Ruth Henderson (wife)', 'ruth.henderson@example.com', false, true, 6, false, null),
  ('W05', 'Arthur', 'Pemberton', '1933-02-07', '5', 1100, 'permanent', null, 'AN-ACC class 10', 'Dr S. Raman', 'Claire Pemberton (daughter)', 'claire.p@example.com', true, true, 11, false, 'High falls risk, sensor mat'),
  ('W06', 'Lan', 'Nguyen', '1946-08-23', '6', 300, 'permanent', null, 'AN-ACC class 4', 'Dr T. Vu', 'Minh Nguyen (son)', 'minh.nguyen@example.com', true, false, 5, false, 'Vietnamese speaker, interpreter for case conferences'),
  ('W07', 'Ivy', 'Nakamura', '1937-03-15', '7', 760, 'permanent', null, 'AN-ACC class 11', 'Dr M. Okafor', 'Ken Nakamura (son)', 'ken.nakamura@example.com', true, true, 9, false, 'Two-hourly repositioning'),
  ('W08', 'George', 'Haddad', '1940-11-01', '8', 95, 'permanent', null, 'AN-ACC class 12', 'Dr T. Vu', 'Rana Haddad (daughter)', 'rana.haddad@example.com', true, false, 8, true, 'Dementia, exit seeking in the evenings'),
  ('W09', 'Dorothy', 'Kemp', '1939-07-27', '9', 540, 'permanent', null, 'AN-ACC class 12', 'Dr S. Raman', 'Alan Kemp (son)', 'alan.kemp@example.com', false, true, 7, false, 'Wanders, wears a locator'),
  ('W10', 'Raymond', 'Ellis', '1945-01-18', '10', 210, 'permanent', null, 'AN-ACC class 7', 'Dr T. Vu', 'Sue Ellis (wife)', 'sue.ellis@example.com', true, true, 6, false, null),
  ('W11', 'Maria', 'Santos', '1942-05-05', '11', 980, 'permanent', null, 'AN-ACC class 6', 'Dr M. Okafor', 'Ana Santos (daughter)', 'ana.santos@example.com', true, true, 8, false, null),
  ('W12', 'Kevin', 'Brady', '1950-10-12', '12', 18, 'respite', null, 'Respite high', 'Dr S. Raman', 'Lorraine Brady (wife)', 'lorraine.brady@example.com', false, false, 4, false, 'Respite to the end of the month'),
  ('W13', 'Norman', 'Fitch', '1931-03-03', '13', 1300, 'deceased', 20, 'AN-ACC class 13', 'Dr S. Raman', 'Jill Fitch (daughter)', 'jill.fitch@example.com', false, true, 5, false, null),
  ('B01', 'Patricia', 'O''Neill', '1936-09-14', '1', 1250, 'permanent', null, 'AN-ACC class 8', 'Dr H. Singh', 'Mark O''Neill (son)', 'mark.oneill@example.com', true, true, 9, false, null),
  ('B02', 'Peter', 'Kowalczyk', '1939-04-04', '2', 830, 'permanent', null, 'AN-ACC class 11', 'Dr H. Singh', 'Anna Kowalczyk (daughter)', 'anna.k@example.com', true, false, 7, false, 'Slides from chair, lap belt in use'),
  ('B03', 'Edna', 'Morris', '1934-12-01', '3', 1600, 'permanent', null, 'AN-ACC class 9', 'Dr J. Fraser', 'Gail Morris (niece)', 'gail.morris@example.com', false, true, 12, false, null),
  ('B04', 'Frank', 'Russo', '1943-08-19', '4', 450, 'permanent', null, 'AN-ACC class 10', 'Dr J. Fraser', 'Tony Russo (son)', 'tony.russo@example.com', true, true, 8, false, null),
  ('B05', 'Shirley', 'Adams', '1938-02-25', '5', 700, 'permanent', null, 'AN-ACC class 7', 'Dr H. Singh', 'Rob Adams (son)', 'rob.adams@example.com', true, true, 6, false, null),
  ('B06', 'Colin', 'Baxter', '1947-06-06', '6', 160, 'permanent', null, 'AN-ACC class 12', 'Dr J. Fraser', 'Helen Baxter (wife)', 'helen.baxter@example.com', true, false, 9, true, 'Dementia, physical responses when rushed'),
  ('B07', 'Beryl', 'Thompson', '1932-10-30', '7', 1900, 'permanent', null, 'AN-ACC class 9', 'Dr H. Singh', 'Lynn Thompson (daughter)', 'lynn.t@example.com', true, true, 10, false, 'Heart failure, daily weights when unwell'),
  ('B08', 'Aziz', 'Rahimi', '1944-03-21', '8', 260, 'permanent', null, 'AN-ACC class 5', 'Dr J. Fraser', 'Farid Rahimi (son)', 'farid.rahimi@example.com', true, false, 5, false, 'Dari speaker'),
  ('B09', 'Gwen', 'Llewellyn', '1940-07-08', '9', 520, 'permanent', null, 'AN-ACC class 6', 'Dr H. Singh', 'Owen Llewellyn (son)', 'owen.l@example.com', false, true, 7, false, null),
  ('B10', 'Harold', 'Stein', '1936-11-11', '10', 1020, 'permanent', null, 'AN-ACC class 8', 'Dr J. Fraser', 'Ruth Stein (daughter)', 'ruth.stein@example.com', true, true, 9, false, null),
  ('K01', 'Moana', 'Tipene', '1940-01-22', '1', 800, 'permanent', null, 'Rest home', 'Dr A. McKenzie', 'Hemi Tipene (son)', 'hemi.tipene@example.com', true, true, 6, false, null),
  ('K02', 'Douglas', 'Fraser', '1935-05-17', '2', 1400, 'permanent', null, 'Hospital', 'Dr A. McKenzie', 'Iain Fraser (son)', 'iain.fraser@example.com', true, true, 10, false, null),
  ('K03', 'Elsie', 'Burton', '1938-08-08', '3', 700, 'permanent', null, 'Dementia', 'Dr P. Chen', 'Janet Burton (daughter)', 'janet.burton@example.com', true, false, 8, false, 'Secure unit'),
  ('K04', 'Tom', 'Whaanga', '1942-12-03', '4', 560, 'in-hospital', null, 'Hospital', 'Dr P. Chen', 'Mere Whaanga (wife)', 'mere.whaanga@example.com', true, true, 9, false, 'In Christchurch Hospital since the 6th day ago'),
  ('K05', 'Agnes', 'Mulholland', '1933-04-29', '5', 1150, 'permanent', null, 'Hospital', 'Dr A. McKenzie', 'Brian Mulholland (son)', 'brian.m@example.com', true, true, 11, false, 'Pressure area care'),
  ('K06', 'Ravi', 'Prasad', '1945-09-09', '6', 330, 'permanent', null, 'Rest home', 'Dr P. Chen', 'Sunita Prasad (daughter)', 'sunita.prasad@example.com', true, false, 5, false, null),
  ('K07', 'Heather', 'Gillespie', '1941-02-14', '7', 30, 'permanent', null, 'Rest home', 'Dr A. McKenzie', 'Craig Gillespie (son)', 'craig.g@example.com', true, false, 7, false, 'New admission'),
  ('K08', 'Wiremu', 'Parata', '1937-06-25', '8', 1000, 'permanent', null, 'Hospital', 'Dr P. Chen', 'Aroha Parata (daughter)', 'aroha.parata@example.com', true, true, 8, false, null)
) as r(code, first_name, last_name, born_on, room, days_in, status, left_days, level, gp, rep, rep_email, to_rep, acp, meds, antipsychotic, alerts)
join homes h on h.code = left(r.code, 1) || case left(r.code, 1) when 'W' then 'ATTLE' when 'B' then 'ANKSIA' else 'OWHAI' end
on conflict (code) do nothing;

update residents set alerts = 'In Christchurch Hospital since ' || to_char(current_date - 6, 'DD Mon') where code = 'K04' and alerts like 'In Christchurch Hospital since the%';

-- ---------------------------------------------------------------- weights (four a quarter; Margaret Doyle falls every month)

insert into weights (resident_id, weighed_on, kg, planned_loss)
select r.id, current_date - w.days_ago, w.kg, false
from (values
  ('W01', 64.0), ('W02', 78.5), ('W04', 82.0), ('W05', 69.4), ('W06', 52.3), ('W07', 58.8), ('W08', 74.1), ('W09', 61.0), ('W10', 88.2), ('W11', 66.7),
  ('B01', 59.9), ('B02', 77.3), ('B03', 55.2), ('B04', 80.6), ('B05', 63.5), ('B06', 84.0), ('B07', 70.2), ('B08', 72.8), ('B09', 60.4), ('B10', 75.0),
  ('K01', 68.0), ('K02', 71.5), ('K03', 54.6), ('K05', 49.8), ('K06', 79.9), ('K08', 83.3)
) as base(code, kg0)
join residents r on r.code = base.code
cross join lateral (values (85, base.kg0), (55, base.kg0 + 0.3), (25, base.kg0 - 0.2), (2, base.kg0 + 0.1)) as w(days_ago, kg)
on conflict (resident_id, weighed_on) do nothing;

insert into weights (resident_id, weighed_on, kg, planned_loss)
select r.id, current_date - w.days_ago, w.kg, false
from residents r cross join (values (85, 71.8), (55, 70.1), (25, 68.6), (2, 67.2)) as w(days_ago, kg)
where r.code = 'W03'
on conflict (resident_id, weighed_on) do nothing;

insert into weights (resident_id, weighed_on, kg, planned_loss)
select r.id, current_date - 20, 71.0, false from residents r where r.code = 'K07'
on conflict (resident_id, weighed_on) do nothing;

-- ---------------------------------------------------------------- assessments

insert into assessments (resident_id, kind, done_on, done_by, score, outcome, next_due_on)
select r.id, a.kind, current_date - a.days_ago, s.id, a.score, a.outcome, current_date - a.days_ago + a.cycle
from (values
  ('W01', 'falls-risk', 70, 'AL', 'Peninsula 12', 'Medium', 90),
  ('W02', 'nutrition', 60, 'BT', 'MNA 9', 'At risk of malnutrition', 90),
  ('W03', 'nutrition', 100, 'BT', 'MNA 10', 'At risk of malnutrition', 90),
  ('W05', 'falls-risk', 100, 'AL', 'Peninsula 19', 'High', 90),
  ('W07', 'pressure-risk', 30, 'CW', 'Waterlow 17', 'High risk', 30),
  ('W08', 'behaviour', 25, 'AL', 'CMAI 58', 'Evening agitation, exit seeking', 60),
  ('W08', 'cognition', 90, 'AL', 'PAS-Cog 14', 'Moderate impairment', 180),
  ('B02', 'falls-risk', 40, 'KV', 'Peninsula 16', 'High', 90),
  ('B06', 'behaviour', 50, 'KV', 'CMAI 64', 'Physical responses during personal care', 60),
  ('B07', 'pain', 20, 'LW', 'Abbey 4', 'Mild', 30),
  ('K01', 'interrai', 120, 'QB', 'CHESS 0', 'Rest home level confirmed', 182),
  ('K02', 'interrai', 215, 'QB', 'CHESS 2', 'Hospital level', 182),
  ('K03', 'interrai', 170, 'RC', 'CPS 4', 'Dementia level', 182),
  ('K04', 'interrai', 90, 'RC', 'CHESS 3', 'Hospital level', 182),
  ('K05', 'interrai', 60, 'QB', 'Pressure ulcer risk 3', 'Hospital level', 182),
  ('K06', 'interrai', 150, 'RC', 'CHESS 1', 'Rest home level', 182),
  ('K08', 'interrai', 40, 'QB', 'CHESS 1', 'Hospital level', 182),
  ('K05', 'pressure-risk', 6, 'RC', 'Braden 11', 'High risk', 14)
) as a(code, kind, days_ago, staff, score, outcome, cycle)
join residents r on r.code = a.code
left join staff s on s.code = a.staff
on conflict (resident_id, kind, done_on) do nothing;

-- ---------------------------------------------------------------- care plan reviews (Australia every 90 days here; New Zealand six-monthly with the interRAI)

insert into care_plan_reviews (resident_id, reviewed_on, reviewed_by, case_conference, representative_attended, summary, next_due_on)
select r.id, current_date - c.days_ago, s.id, c.conf, c.rep, c.summary, current_date - c.days_ago + case when c.code like 'K%' then 182 else 90 end
from (values
  ('W01', 40, 'AL', true, true, 'Settled. Walks to the dining room with a frame.'),
  ('W02', 30, 'BT', false, false, 'Speech pathology review, fluids stay at level 2.'),
  ('W03', 60, 'BT', true, true, 'Appetite down. Fortified diet started, weigh weekly.'),
  ('W04', 20, 'AL', false, false, 'No change.'),
  ('W05', 35, 'AL', true, true, 'Falls plan updated after the second fall: sensor mat, low bed.'),
  ('W06', 50, 'CW', true, true, 'Interpreter used. Prefers showers in the evening.'),
  ('W07', 25, 'CW', false, false, 'Pressure injury plan, two-hourly repositioning.'),
  ('W08', 70, 'AL', true, true, 'Admission care plan. Evening walk with a carer.'),
  ('W09', 45, 'DN', false, false, 'Locator checked weekly.'),
  ('W10', 15, 'BT', false, false, 'No change.'),
  ('W11', 102, 'AL', true, true, 'No change.'),
  ('B01', 30, 'KV', true, true, 'No change.'),
  ('B02', 55, 'KV', true, true, 'Lap belt while seated, reviewed with the physiotherapist.'),
  ('B03', 20, 'LW', false, false, 'Pain well controlled.'),
  ('B04', 40, 'KV', false, false, 'No change.'),
  ('B05', 60, 'LW', true, false, 'No change.'),
  ('B06', 45, 'KV', true, true, 'Behaviour support plan written. Two staff for personal care.'),
  ('B07', 12, 'LW', false, false, 'Back from hospital, fluid restriction 1.5 litres.'),
  ('B08', 35, 'KV', true, true, 'Interpreter used.'),
  ('B09', 80, 'LW', false, false, 'No change.'),
  ('B10', 25, 'KV', false, false, 'No change.'),
  ('K01', 110, 'QB', true, true, 'Long-term care plan from the interRAI.'),
  ('K02', 60, 'QB', true, true, 'Long-term care plan reviewed.'),
  ('K03', 160, 'RC', true, true, 'Long-term care plan reviewed.'),
  ('K04', 85, 'RC', false, false, 'Long-term care plan reviewed.'),
  ('K05', 50, 'QB', true, true, 'Long-term care plan reviewed.'),
  ('K06', 140, 'RC', true, false, 'Long-term care plan reviewed.'),
  ('K08', 35, 'QB', true, true, 'Long-term care plan reviewed.')
) as c(code, days_ago, staff, conf, rep, summary)
join residents r on r.code = c.code
left join staff s on s.code = c.staff
on conflict (resident_id, reviewed_on) do nothing;

-- ---------------------------------------------------------------- wounds

insert into wounds (resident_id, kind, stage, site, found_on, acquired_here, next_dressing_on, healed_on)
select r.id, w.kind, w.stage, w.site, current_date - w.found, w.here, case when w.dressing is null then null else current_date + w.dressing end, case when w.healed is null then null else current_date - w.healed end
from (values
  ('W07', 'pressure-injury', '2', 'Sacrum', 12, true, -2, null::int),
  ('W02', 'skin-tear', null, 'Left forearm', 9, true, 1, null),
  ('B03', 'pressure-injury', '1', 'Right heel', 40, true, null, 18),
  ('K05', 'pressure-injury', '3', 'Left hip', 5, true, 1, null)
) as w(code, kind, stage, site, found, here, dressing, healed)
join residents r on r.code = w.code
on conflict (resident_id, site, found_on) do nothing;

-- ---------------------------------------------------------------- incidents

insert into incidents (home_id, resident_id, reference, occurred_at, aware_at, kind, injury, sirs_type, sirs_priority, s31_required, reported_at, report_reference,
  police_notified_at, open_disclosure_on, gp_notified_on, description, actions, closed_on)
select h.id, r.id, i.ref, b.base, b.base + (i.occ_hours - i.aware_hours) * interval '1 hour', i.kind, i.injury, i.sirs_type, i.priority, i.s31,
  case when i.rep_hours is null then null else b.base + (i.occ_hours - i.rep_hours) * interval '1 hour' end, i.rep_ref,
  case when i.police_hours is null then null else b.base + (i.occ_hours - i.police_hours) * interval '1 hour' end,
  case when i.disclosed is null then null else current_date - i.disclosed end,
  case when i.gp is null then null else current_date - i.gp end, i.description, i.actions,
  case when i.closed is null then null else current_date - i.closed end
from (values
  ('INC-2026-0141', null::int, 'BANKSIA', 'B04', 31, 30, 'behaviour', 'needs-treatment', 'unreasonable-force', 1, false, null::int, null, null::int, 1, 1,
   'Colin Baxter pushed Frank Russo in the lounge after dinner. Frank fell against the table and has a cut above the left eye that needed steri-strips from the GP.', 'Residents separated. Colin on 15 minute checks. GP reviewed Frank.', null::int),
  ('INC-2026-0127', 9, 'WATTLE', 'W10', 34 * 24 + 2, 34 * 24, 'complaint', 'none', 'psychological-abuse', 2, false, null, null, null, null, null,
   'Sue Ellis reported that an agency carer shouted at Raymond and called him lazy during his morning shower.', 'Agency told the carer is not to return.', null),
  ('INC-2026-0119', 15, 'WATTLE', 'W09', 20 * 24 + 3, 20 * 24 + 2, 'absence', 'none', 'unexplained-absence', 1, false, 20 * 24 - 16, 'SIRS-8830142', 20 * 24 + 1, 19, 19,
   'Dorothy Kemp left through the garden gate during the afternoon. Staff noticed at 3.40pm, police notified at 4.05pm, found unharmed at the shops at 5.10pm.', 'Gate latch replaced. Locator checked daily.', 10),
  ('INC-2026-0133', 2, 'WATTLE', 'W05', 10 * 24, 10 * 24, 'fall', 'needs-treatment', null, null, false, null, null, null, 9, 10,
   'Unwitnessed fall in the bathroom at 2am. Pain in the right wrist, sent to Nepean ED, fracture confirmed and plastered.', 'Sensor mat moved to the bathroom side. Physio review.', null),
  ('INC-2026-0108', 6, 'WATTLE', 'W05', 35 * 24, 35 * 24, 'fall', 'minor', null, null, false, null, null, null, 34, 34,
   'Found on the floor beside the bed at 6am. Skin tear to the elbow.', 'Low bed and sensor mat.', 30),
  ('INC-2026-0081', 12, 'WATTLE', 'W05', 70 * 24, 70 * 24, 'fall', 'none', null, null, false, null, null, null, 69, 69,
   'Slid from the chair in the dining room. No injury.', 'Physio review of seating.', 65),
  ('INC-2026-0139', 10, 'WATTLE', 'W02', 9 * 24, 9 * 24, 'skin', 'minor', null, null, false, null, null, null, 9, null,
   'Skin tear to the left forearm during a transfer.', 'Dressing, limb protectors.', null),
  ('INC-2026-0143', 8, 'KOWHAI', 'K05', 5 * 24, 5 * 24, 'skin', 'needs-treatment', null, null, true, null, null, null, 4, 5,
   'Stage 3 pressure injury found on the left hip during the morning cares.', 'Air mattress, two-hourly turns, wound nurse referral.', null),
  ('INC-2026-0098', 3, 'BANKSIA', 'B07', 21 * 24, 21 * 24, 'other', 'needs-treatment', null, null, false, null, null, null, 20, 21,
   'Short of breath overnight, ambulance called, admitted to University Hospital Geelong with heart failure.', 'Back on the 14th day ago, daily weights.', 14)
) as i(ref, hr, home, resident, occ_hours, aware_hours, kind, injury, sirs_type, priority, s31, rep_hours, rep_ref, police_hours, disclosed, gp, description, actions, closed)
cross join lateral (select case when i.hr is null then now() - i.occ_hours * interval '1 hour'
  else (current_date - i.occ_hours / 24)::timestamp + i.hr * interval '1 hour' end as base) b
join homes h on h.code = i.home
left join residents r on r.code = i.resident
on conflict (reference) do nothing;

update incidents set actions = 'Back from hospital ' || to_char(current_date - 14, 'DD Mon') || ', daily weights.' where reference = 'INC-2026-0098' and actions like 'Back on the%';

-- ---------------------------------------------------------------- restrictive practices

insert into restrictive_practices (resident_id, kind, description, started_on, ended_on, consent_from, consent_on, prescriber, behaviour_support_plan_on, review_due_on)
select r.id, p.kind, p.description, current_date - p.started, null, p.consent_from,
  case when p.consent is null then null else current_date - p.consent end, p.prescriber,
  case when p.plan is null then null else current_date - p.plan end, current_date + p.review
from (values
  ('W08', 'chemical', 'Risperidone 0.5mg at 5pm for evening agitation and exit seeking', 20, null, null::int, 'Dr T. Vu', 18, 40),
  ('W08', 'environmental', 'Keypad on the front door of the wing', 95, 'Rana Haddad (daughter, enduring guardian)', 94, null, 90, 30),
  ('B02', 'mechanical', 'Lap belt while seated in the tilt chair', 120, 'Anna Kowalczyk (daughter, enduring guardian)', 118, null, 115, -9),
  ('B06', 'chemical', 'Quetiapine 25mg at night for physical responses during personal care', 60, 'Helen Baxter (wife, enduring guardian)', 59, 'Dr J. Fraser', 58, 25),
  ('K03', 'environmental', 'Secure dementia unit', 700, 'Janet Burton (daughter, enduring power of attorney)', 700, null, 160, 20)
) as p(code, kind, description, started, consent_from, consent, prescriber, plan, review)
join residents r on r.code = p.code
on conflict (resident_id, kind, started_on) do nothing;

-- ---------------------------------------------------------------- hospital transfers

insert into hospital_transfers (resident_id, left_on, kind, reason, returned_on)
select r.id, current_date - t.left_days, t.kind, t.reason, case when t.back is null then null else current_date - t.back end
from (values
  ('W05', 10, 'emergency-department', 'Fractured right wrist after a fall', 10),
  ('B07', 21, 'admitted', 'Heart failure', 14),
  ('K04', 6, 'admitted', 'Pneumonia', null::int),
  ('W01', 75, 'emergency-department', 'Chest pain, cleared', 75)
) as t(code, left_days, kind, reason, back)
join residents r on r.code = t.code
on conflict (resident_id, left_on) do nothing;

-- ---------------------------------------------------------------- last month, for the monthly care statements

insert into activities (resident_id, done_on, domain, activity)
select r.id, (date_trunc('month', current_date) - interval '1 month')::date + a.d, a.domain, a.activity
from (values
  ('W01', 3, 'physical', 'Seated exercise class'), ('W01', 10, 'social', 'Morning tea with the Penrith Rotary visitors'), ('W01', 17, 'cognitive', 'Quiz afternoon'), ('W01', 24, 'spiritual', 'Anglican service'),
  ('W02', 5, 'social', 'Greek community visit'), ('W02', 12, 'emotional', 'Video call with his grandchildren'), ('W02', 19, 'physical', 'Walk in the garden'),
  ('W03', 4, 'cognitive', 'Crossword with a volunteer'), ('W03', 14, 'social', 'Hairdresser'), ('W03', 21, 'emotional', 'Pet therapy'),
  ('W05', 8, 'physical', 'Physio walking programme'), ('W05', 22, 'social', 'Bus trip to Emu Plains'),
  ('B01', 6, 'social', 'Concert by the Geelong Ukulele Group'), ('B01', 20, 'spiritual', 'Catholic mass'),
  ('B04', 9, 'physical', 'Bocce'), ('B04', 23, 'social', 'Football on TV with the men''s group')
) as a(code, d, domain, activity)
join residents r on r.code = a.code
on conflict (resident_id, done_on, activity) do nothing;

insert into medication_changes (resident_id, changed_on, medicine, change, detail, prescriber)
select r.id, (date_trunc('month', current_date) - interval '1 month')::date + m.d, m.medicine, m.change, m.detail, m.prescriber
from (values
  ('W02', 7, 'Amoxicillin', 'started', '500mg three times a day for 5 days, chest infection', 'Dr S. Raman'),
  ('W03', 11, 'Fortified supplement drink', 'started', 'Twice a day between meals', 'Dr M. Okafor'),
  ('W05', 15, 'Temazepam', 'ceased', 'Stopped to reduce the falls risk', 'Dr S. Raman'),
  ('B01', 18, 'Metoprolol', 'dose-changed', '25mg to 50mg twice a day', 'Dr H. Singh')
) as m(code, d, medicine, change, detail, prescriber)
join residents r on r.code = m.code
on conflict (resident_id, changed_on, medicine) do nothing;

insert into appointments (resident_id, seen_on, with_whom, reason, offsite)
select r.id, (date_trunc('month', current_date) - interval '1 month')::date + p.d, p.who, p.reason, p.offsite
from (values
  ('W01', 2, 'GP, Dr S. Raman', 'Monthly review', false), ('W01', 16, 'Podiatrist', 'Nail care', false),
  ('W02', 7, 'GP, Dr S. Raman', 'Chest infection', false), ('W02', 20, 'Speech pathologist', 'Swallow review', false),
  ('W03', 11, 'GP, Dr M. Okafor', 'Weight loss review', false), ('W03', 18, 'Dietitian', 'Fortified diet plan', false),
  ('W05', 15, 'GP, Dr S. Raman', 'Medication review after falls', false), ('W05', 25, 'Physiotherapist', 'Mobility and falls', false),
  ('B01', 18, 'GP, Dr H. Singh', 'Blood pressure', false), ('B01', 26, 'Cardiologist, Geelong', 'Six-monthly review', true)
) as p(code, d, who, reason, offsite)
join residents r on r.code = p.code
on conflict (resident_id, seen_on, with_whom) do nothing;

-- ---------------------------------------------------------------- progress notes

insert into progress_notes (resident_id, written_at, written_by, kind, body)
select r.id, date_trunc('day', now()) - n.days_ago * interval '1 day' + n.hour * interval '1 hour', s.id, n.kind, n.body
from (values
  ('W03', 3, 14, 'BT', 'clinical', 'Ate half of lunch. Supplement drink taken. Weighed 67.2kg.'),
  ('W05', 10, 3, 'DN', 'clinical', 'Found on the bathroom floor at 2am, complaining of right wrist pain. Ambulance called.'),
  ('W08', 2, 18, 'DN', 'behaviour', 'Restless from 5pm, tried the front door twice. Walked with a carer, settled by 7pm.'),
  ('B06', 1, 19, 'LW', 'behaviour', 'Pushed another resident in the lounge after dinner. Separated, 15 minute checks started.'),
  ('K07', 29, 11, 'QB', 'clinical', 'Admitted from home. Settling in, daughter visiting daily.'),
  ('K05', 5, 9, 'RC', 'clinical', 'Stage 3 pressure injury on the left hip. Photographed, wound nurse referral sent.'),
  ('W10', 34, 10, 'BT', 'family', 'Sue Ellis upset about how an agency carer spoke to Raymond. Manager informed.')
) as n(code, days_ago, hour, staff, kind, body)
join residents r on r.code = n.code
left join staff s on s.code = n.staff
on conflict (resident_id, written_at, body) do nothing;

-- ---------------------------------------------------------------- shifts: 30 days of rosters

-- Registered nurses round the clock at every home: 07:00 to 15:30, 15:00 to 23:30, 23:00 to 07:30.
-- Banksia House's night shift four nights ago was never filled.
insert into shifts (home_id, staff_id, role, starts_at, ends_at, break_minutes)
select h.id, s.id, s.role, d::date + t.starts, d::date + t.starts + t.length, 30
from (values
  ('WATTLE', 'AL', time '07:00', interval '8 hours 30 minutes'), ('WATTLE', 'BT', time '15:00', interval '8 hours 30 minutes'), ('WATTLE', 'DN', time '23:00', interval '8 hours 30 minutes'),
  ('WATTLE', 'EM', time '07:00', interval '8 hours 30 minutes'),
  ('WATTLE', 'FP', time '07:00', interval '8 hours 30 minutes'), ('WATTLE', 'GR', time '07:00', interval '8 hours 30 minutes'), ('WATTLE', 'HS', time '15:00', interval '8 hours 30 minutes'),
  ('BANKSIA', 'KV', time '07:00', interval '8 hours 30 minutes'), ('BANKSIA', 'MX', time '15:00', interval '8 hours 30 minutes'), ('BANKSIA', 'LW', time '23:00', interval '8 hours 30 minutes'),
  ('BANKSIA', 'NY', time '07:00', interval '8 hours 30 minutes'),
  ('KOWHAI', 'QB', time '07:00', interval '8 hours 30 minutes'), ('KOWHAI', 'RC', time '15:00', interval '8 hours 30 minutes'), ('KOWHAI', 'UH', time '23:00', interval '8 hours 30 minutes'),
  ('KOWHAI', 'SD', time '07:00', interval '8 hours 30 minutes'), ('KOWHAI', 'TE', time '15:00', interval '8 hours 30 minutes')
) as t(home, staff, starts, length)
join homes h on h.code = t.home
join staff s on s.code = t.staff
cross join generate_series(current_date - 30, current_date - 1, interval '1 day') d
where not (t.home = 'BANKSIA' and t.staff = 'LW' and d::date = current_date - 4)
on conflict (home_id, staff_id, starts_at) do nothing;

-- Oscar Price worked Banksia's afternoon shifts until he left 30 days ago.
insert into shifts (home_id, staff_id, role, starts_at, ends_at, break_minutes)
select h.id, s.id, 'PCW', d::date + time '15:00', d::date + time '23:30', 30
from homes h join staff s on s.code = 'OP'
cross join generate_series(current_date - 90, current_date - 31, interval '1 day') d
where h.code = 'BANKSIA'
on conflict (home_id, staff_id, starts_at) do nothing;

-- ---------------------------------------------------------------- quality indicator submissions

insert into qi_submissions (home_id, quarter_start, submitted_on, submitted_by)
select h.id, (date_trunc('quarter', current_date) - interval '3 months')::date,
  least(current_date, (date_trunc('quarter', current_date) + interval '15 days')::date), 'Anika Lal'
from homes h where h.code = 'WATTLE'
on conflict (home_id, quarter_start) do nothing;

-- ---------------------------------------------------------------- notes

insert into notes (home_id, body, author, created_at)
select h.id, n.body, n.author, now() - n.days_ago * interval '1 day'
from (values
  ('BANKSIA', 'Agency could not fill the night RN shift. Kirsten on call by phone.', 'Kirsten Vaughan', 4),
  ('WATTLE', 'Accreditation contact visit expected in the next quarter.', 'Anika Lal', 12)
) as n(home, body, author, days_ago)
join homes h on h.code = n.home
where not exists (select 1 from notes x where x.body = n.body);
