#!/usr/bin/env node
// End-to-end smoke test on a throwaway embedded database: migrate, seed, then every command
// that matters, asserting on the JSON. Passes on Windows and Linux. No network, no Postgres install.
// TEST_DATABASE_URL runs the same test against a real Postgres (CI does this).

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = mkdtempSync(path.join(tmpdir(), 'ac-smoke-'));
const exportDir = path.join(dataDir, 'export');
const env = { ...process.env, DATA_DIR: dataDir };
delete env.DATABASE_URL;
if (process.env.TEST_DATABASE_URL) env.DATABASE_URL = process.env.TEST_DATABASE_URL;

let step = 0;
function run(label, args, { json = true, expectFail = false } = {}) {
  step++;
  const argv = [path.join(root, 'scripts', args[0]), ...args.slice(1), ...(json ? ['--json'] : [])];
  const res = spawnSync(process.execPath, argv, { cwd: root, env, encoding: 'utf8' });
  const ok = expectFail ? res.status !== 0 : res.status === 0;
  if (!ok) {
    console.error(`\nFAIL step ${step} (${label}): exit ${res.status}\n--- stdout\n${res.stdout}\n--- stderr\n${String(res.stderr).split('\n').filter((l) => !l.startsWith('import{')).join('\n').slice(0, 4000)}`);
    process.exit(1);
  }
  console.log(`  ok  ${String(step).padStart(2)}  ${label}`);
  if (!json || expectFail) return { stdout: res.stdout, stderr: res.stderr };
  try { return JSON.parse(res.stdout); } catch {
    console.error(`\nFAIL step ${step} (${label}): output is not JSON\n${res.stdout}\n${res.stderr}`);
    process.exit(1);
  }
}
function assert(cond, msg) { if (!cond) { console.error(`\nFAIL assertion: ${msg}`); process.exit(1); } }
const A = (...a) => ['ac.mjs', ...a];
const rule = (rows, id) => rows.find((r) => r.id === id);
const pad = (x) => String(x).padStart(2, '0');
const now = new Date();
const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

console.log(`smoke: ${env.DATABASE_URL ? 'Postgres' : 'embedded database in ' + dataDir}`);
try {
  run('migrate', ['migrate.mjs'], { json: false });
  run('migrate again (idempotent)', ['migrate.mjs'], { json: false });
  run('seed', ['seed.mjs'], { json: false });
  run('seed again (idempotent)', ['seed.mjs'], { json: false });

  // ---- the overview
  const stats = run('stats', A('stats'));
  assert(stats.homes === 3 && stats.residents === 30 && stats.in_hospital === 1 && stats.late_reports === 2, `three homes, 30 residents, one in hospital, two late reports (${JSON.stringify(stats)})`);
  const homes = run('homes', A('homes'));
  const banksia = homes.find((h) => h.home === 'BANKSIA');
  assert(banksia.residents === 10 && banksia.care_minutes < banksia.care_minutes_target && banksia.rn_minutes > banksia.rn_minutes_target, 'Banksia under its care minutes target, over the RN target');
  assert(homes.find((h) => h.home === 'KOWHAI').care_minutes_target === null, 'no care minutes target in New Zealand');
  const card = run('resident by name', A('resident', 'pemberton'));
  assert(card.resident.code === 'W05' && card.incidents.length === 3 && card.transfers.length === 1, 'fuzzy resident lookup and the resident card');
  run('ambiguous resident lists and exits 1', A('resident', 'an'), { json: false, expectFail: true });
  const res = run('residents at a home', A('residents', '--home=KOWHAI'));
  assert(res.length === 8 && res.every((r) => r.home === 'KOWHAI'), 'eight residents at Kowhai');
  assert(run('staff', A('staff')).length === 17, 'seventeen current staff (one has left)');

  // ---- reporting clocks
  const sirs = run('sirs', A('sirs'));
  const p1 = sirs.find((s) => s.reference === 'INC-2026-0141');
  assert(p1.flag === 'PAST DUE' && p1.hours_left <= -5 && p1.hours_left >= -7, 'Priority 1 six hours past its 24 hour deadline');
  assert(sirs.find((s) => s.reference === 'INC-2026-0127').flag === 'PAST DUE', 'Priority 2 past its 30 days');
  assert(sirs.find((s) => s.reference === 'INC-2026-0119').flag === '', 'the absence was reported in time');
  assert(sirs.find((s) => s.reference === 'INC-2026-0143').scheme.startsWith('Section 31'), 'the New Zealand pressure injury is a Section 31');
  const inc = run('incidents open', A('incidents'));
  assert(inc.length === 5 && inc.some((i) => i.flag === 'REPORT LATE'), 'five open incidents, one flagged');
  const ni = run('incident with a suggested priority', A('incident', 'WATTLE', 'behaviour', 'Raymond Ellis pushed Bill Henderson at the lift; graze to the hand, dressed by the RN', '--resident=W10', '--injury=minor', '--sirs=unreasonable-force'));
  assert(ni.reference === 'INC-' + now.getFullYear() + '-0144' || ni.reference.startsWith('INC-'), 'a new reference');
  assert(ni.sirs_priority === 2 && ni.report_due_at, 'minor injury suggests Priority 2 with a 30 day deadline');
  const p1b = run('incident needing treatment is Priority 1', A('incident', 'BANKSIA', 'absence', 'Shirley Adams not in her room at 9pm, police called, found at the bus stop', '--resident=B05', '--sirs=unexplained-absence', '--police=now'));
  assert(p1b.sirs_priority === 1, 'an absence reported to police is Priority 1');
  run('SIRS refused in New Zealand', A('incident', 'KOWHAI', 'fall', 'x', '--sirs=neglect'), { json: false, expectFail: true });
  run('Section 31 refused in Australia', A('incident', 'WATTLE', 'fall', 'x', '--s31'), { json: false, expectFail: true });
  run('resident must live at the home', A('incident', 'WATTLE', 'fall', 'x', '--resident=B01'), { json: false, expectFail: true });
  run('close refuses an unreported SIRS incident', A('close', '0141'), { json: false, expectFail: true });
  const rep = run('report the Priority 1', A('report', 'INC-2026-0141', '--ref=SIRS-9001234'));
  assert(rep.late === true, 'reported after the deadline is recorded as late');
  run('open disclosure', A('disclose', '0127'));
  run('close', A('close', '0141'));

  // ---- restrictive practices
  const rp = run('restrictive', A('restrictive'));
  assert(rp.length === 5 && rp.find((r) => r.resident === 'W08' && r.kind === 'chemical').missing === 'consent' && rp.find((r) => r.resident === 'B02').missing === 'review overdue', 'missing consent and an overdue review');
  const rc = run('record consent on the one in use', A('restrict', 'W08', 'chemical', '--consent-from=Rana Haddad (daughter, enduring guardian)', '--consent-on=today'));
  assert(rc.missing.length === 0, 'consent recorded');
  const nr = run('a new restrictive practice', A('restrict', 'B06', 'physical', 'Two staff hold hands during personal care when distressed', '--started=today'));
  assert(nr.missing.includes('informed consent') && nr.missing.includes('a behaviour support plan'), 'new practice lists what is missing');
  run('end it', A('restrict-end', 'B06', 'physical'));
  run('bad kind refused', A('restrict', 'B06', 'cuddles', 'x'), { json: false, expectFail: true });

  // ---- clinical
  const w = run('weights', A('weights'));
  assert(w.length === 1 && w[0].code === 'W03' && w[0].change_pct === -6.4 && w[0].consecutive_loss, 'Margaret Doyle down 6.4%, lower every month');
  const wg = run('weigh', A('weigh', 'Doyle', '66.5'));
  assert(wg.trend.significant === true, 'still significant after a new weight');
  run('weigh refuses nonsense', A('weigh', 'W03', 'heavy'), { json: false, expectFail: true });
  const fl = run('falls', A('falls'));
  assert(fl.length === 1 && fl[0].code === 'W05' && fl[0].falls === 3 && fl[0].needing_treatment === 1 && fl[0].repeat, 'Arthur Pemberton, three falls, one needing treatment');
  const wo = run('wounds', A('wounds'));
  assert(wo.length === 3 && wo.find((x) => x.resident === 'W07').dressing_overdue === true, 'three open wounds, one dressing overdue');
  const nw = run('a stage 3 in New Zealand prompts Section 31', A('wound', 'K06', 'pressure-injury', 'Right heel', '--stage=3'));
  assert(nw.s31_likely === true, 'Section 31 prompt');
  run('heal', A('heal', 'K06', 'heel'));
  run('wound needs a site', A('wound', 'K06', 'skin-tear'), { json: false, expectFail: true });

  // ---- assessments and care plans
  const as = run('assessments due', A('assessments'));
  assert(as.some((a) => a.code === 'K07' && a.kind === 'interrai (first)' && a.days_left < 0), 'K07 first interRAI late');
  assert(as.some((a) => a.code === 'K02' && a.kind === 'interrai' && a.days_left < 0) && as.some((a) => a.code === 'K03' && a.days_left > 0), 'K02 late, K03 coming up');
  const cp = run('care plans due', A('care-plans'));
  assert(cp.some((c) => c.code === 'W11' && c.days_left < 0) && cp.some((c) => c.code === 'K07' && c.first), 'W11 overdue, K07 has none');
  run('assess', A('assess', 'K07', 'interrai', '--score=CHESS 1', '--outcome=Rest home level', '--by=QB'));
  run('review', A('review', 'K07', '--conference', '--rep-attended', '--summary=Long-term care plan from the interRAI', '--by=QB'));
  run('bad assessment kind refused', A('assess', 'K07', 'vibes'), { json: false, expectFail: true });

  // ---- workforce
  const cm = run('care minutes', A('care-minutes'));
  const cb = cm.find((c) => c.home === 'BANKSIA');
  assert(cb.total_met === false && cb.rn_met === true && cb.total_short_minutes_per_day > 200, 'Banksia short on total minutes');
  assert(cm.find((c) => c.home === 'WATTLE').total_met === true && cm.find((c) => c.home === 'KOWHAI').total_met === null, 'Wattle met, Kowhai not measured');
  const gaps = run('rn cover', A('rn-cover'));
  assert(gaps.length === 2 && gaps.every((g) => g.home === 'BANKSIA') && gaps.reduce((a, g) => a + g.minutes, 0) === 450, 'seven and a half hours with no RN at Banksia');
  const ck = run('checks', A('checks'));
  assert(ck.find((c) => c.code === 'MX').registration_days_left < 0 && ck.find((c) => c.code === 'MX').rostered_recently, 'MX expired and rostered');
  assert(ck.find((c) => c.code === 'SD').screening_days_left < 0, 'SD police check expired');

  // ---- quality indicators and the monthly care statement
  const q = run('qi over the last 91 days', A('qi', '--days=91'));
  const qw = q.homes.find((h) => h.home === 'WATTLE').indicators;
  const ind = (name) => qw.find((i) => i.indicator.startsWith(name)).count;
  assert(ind('Significant unplanned') === 1 && ind('Consecutive') === 1 && ind('Falls with major') === 1 && ind('Pressure injuries') === 1, 'Wattle: weight loss, a fall with major injury, a pressure injury');
  assert(q.homes.find((h) => h.home === 'BANKSIA').indicators.find((i) => i.indicator.startsWith('Staff who left')).count === 1, 'Banksia: one staff member left');
  const qp = run('qi for last quarter', A('qi'));
  assert(qp.homes.find((h) => h.home === 'WATTLE').submission.submitted_on && qp.homes.find((h) => h.home === 'KOWHAI').submission === null, 'Wattle submitted, Kowhai not in the programme');
  const st = run('monthly care statement', A('statement', 'W03'));
  assert(st.statement_id === 'MD35' && st.wellbeing.length === 3 && st.medication_changes.length === 1 && st.appointments.length === 2 && st.to_representative.startsWith('Fiona'), 'Margaret Doyle\'s statement for last month');
  run('qi-submit refused in New Zealand', A('qi-submit', 'KOWHAI'), { json: false, expectFail: true });

  // ---- compliance, before and after the fixes above
  const comp = run('compliance', A('compliance'));
  assert(comp.length === 15, 'fifteen rules');
  const [qy, qm] = [now.getFullYear(), Math.floor(now.getMonth() / 3) * 3];
  const dueDate = new Date(qy, qm, 21);
  const qiDue = `${dueDate.getFullYear()}-${pad(dueDate.getMonth() + 1)}-${pad(dueDate.getDate())}`;
  assert(rule(comp, 'R10').count === (todayIso > qiDue ? 1 : 0), `R10 Banksia late only after the 21st (${qiDue})`);
  for (const id of ['R2', 'R4', 'R6', 'R8', 'R9', 'R13', 'R15']) assert(rule(comp, id).count === 1, `${id} finds the planted breach (${JSON.stringify(rule(comp, id))})`);
  assert(rule(comp, 'R5').count === 2, 'R5 two days with a gap');
  for (const id of ['R1', 'R3', 'R7', 'R11', 'R12', 'R14']) assert(rule(comp, id).count === 0, `${id} clear after the fixes (${JSON.stringify(rule(comp, id))})`);
  run('qi-submit', A('qi-submit', 'BANKSIA', '--by=Kirsten Vaughan'));
  assert(rule(run('compliance after the QI submission', A('compliance')), 'R10').count === 0, 'R10 clear');
  const att = run('attention', A('attention'));
  assert(att[0].area === 'Compliance' && att.some((a) => a.area === 'Clinical' && a.what.startsWith('W03')) && att.some((a) => a.area === 'Hospital'), 'attention leads with compliance, has the weight loss and the hospital stay');

  // ---- residents in and out
  const ad = run('admit', A('admit', 'KOWHAI', 'Joy Mackenzie', '--room=9', '--level=Rest home', '--rep=Liam Mackenzie (son)'));
  assert(ad.code === 'K09' && ad.due[0].includes('interRAI'), 'K09 admitted with its 21 day clock');
  run('hospital', A('hospital', 'W01', '--kind=admitted', '--reason=Chest pain'));
  assert(run('in hospital', A('resident', 'W01')).resident.status === 'in-hospital', 'W01 in hospital');
  const back = run('returned', A('returned', 'W01'));
  assert(back.days_away === 0, 'back the same day');
  run('discharge', A('discharge', 'W12', '--reason=discharged'));
  assert(run('residents after discharge', A('residents', '--home=WATTLE')).length === 11, 'eleven at Wattle');
  run('log', A('log', 'W03', 'Ate all of lunch today', '--kind=clinical', '--by=BT'));

  // ---- import from Leecare, export
  const dry = run('import residents dry run', A('import', 'leecare', 'residents', 'examples/leecare-residents.csv', '--home=BANKSIA', '--dry-run'));
  assert(dry.would_save === 3 && dry.saved === 0 && dry.skipped.length === 1, 'dry run reads three residents and skips the blank row');
  const ir = run('import residents', A('import', 'leecare', 'residents', 'examples/leecare-residents.csv', '--home=BANKSIA'));
  assert(ir.saved === 3, 'three residents');
  run('import residents again (idempotent)', A('import', 'leecare', 'residents', 'examples/leecare-residents.csv', '--home=BANKSIA'));
  const br = run('imported residents', A('residents', '--home=BANKSIA'));
  assert(br.length === 13 && br.find((r) => r.name === 'Lorna Watts').status === 'respite' && br.find((r) => r.name === 'June Hollis').code === 'B11', 'thirteen at Banksia, codes continue, respite read');
  const iw = run('import weights', A('import', 'leecare', 'weights', 'examples/leecare-weights.csv', '--home=BANKSIA'));
  assert(iw.saved === 5 && iw.skipped.length === 1, 'five weights, the unknown resident skipped');
  const ii = run('import incidents', A('import', 'leecare', 'incidents', 'examples/leecare-incidents.csv', '--home=BANKSIA'));
  assert(ii.saved === 2, 'two incidents');
  const all = run('imported incidents', A('incidents', '--all', '--home=BANKSIA'));
  const lc = all.find((i) => i.reference === 'LC-55031');
  assert(lc.sirs === 'P1 unreasonable-force' && lc.reported_at && lc.injury === 'needs-treatment' && all.find((i) => i.reference === 'LC-55012').kind === 'fall', 'types, injury and SIRS read from the export');
  run('import refuses an unknown source', A('import', 'carelink', 'residents', 'x.csv', '--home=BANKSIA'), { json: false, expectFail: true });
  const exp = run('export', A('export', `--out=${exportDir}`));
  assert(exp.counts.homes === 3 && existsSync(path.join(exportDir, 'incidents.csv')), 'export writes every table');

  // ---- views and documents render
  const view = run('view', ['view.mjs'], { json: false });
  assert(/view: views/.test(view.stdout), 'views render');
  const docs = run('docs', ['docs.mjs'], { json: false });
  assert(/document\(s\) rendered/.test(docs.stdout) && !/^0 document/m.test(docs.stdout), 'documents render');

  console.log(`\nPASS: ${step} steps`);
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
