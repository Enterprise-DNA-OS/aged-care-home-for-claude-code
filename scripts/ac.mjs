#!/usr/bin/env node
// aged-care-home-for-claude-code: the one CLI. The slash commands call this; so can you.
//
//   node scripts/ac.mjs <command> [args] [--flags] [--json]
//   npm run ac -- <command> ...
//
// Run with no arguments (or `help`) for the command list.
//
// This records what a residential aged care provider keeps for its homes: residents, assessments
// and care plan reviews, weights, wounds, incidents with their reporting clocks, restrictive
// practices, hospital transfers, shifts for care minutes and registered nurse cover, and the
// quality indicators. It sends nothing and lodges nothing: SIRS and Section 31 notifications are
// drafted here and lodged by a person in the regulator's portal, and medication charting stays in
// the home's electronic medication chart.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv, pick } from './lib/csv.mjs';
import { table, isoDate, dateTime, truncate, heading } from './lib/format.mjs';

// ---------------------------------------------------------------- settings

// Anything due inside this many days is listed as coming up.
const DUE_SOON_DAYS = 14;
// Australian homes review each care plan at least this often (a house rule; change it to yours).
const CARE_PLAN_REVIEW_DAYS = 90;
// New Zealand: the first interRAI and the long-term care plan within 21 days of admission (ARRC D16).
const NZ_FIRST_DAYS = 21;
// New Zealand: interRAI reassessment at least six-monthly.
const INTERRAI_CYCLE_DAYS = 182;
// Unplanned weight loss of this much over about three months is significant (the QI programme uses 5%).
const WEIGHT_LOSS_PCT = 5;
// This many falls inside FALLS_WINDOW_DAYS makes a repeat faller.
const REPEAT_FALLS = 3;
const FALLS_WINDOW_DAYS = 90;
// Open disclosure recorded within this many days of an incident with harm.
const OPEN_DISCLOSURE_DAYS = 7;
// A Section 31 notification still not made after this many hours is flagged (a house setting:
// the Act says as soon as reasonably practicable).
const S31_WAIT_HOURS = 48;
// Care minutes are read over this many days.
const CARE_MINUTES_DAYS = 28;
// Registered nurse cover is checked over this many days.
const RN_COVER_DAYS = 14;
// Registrations and police checks expiring inside this many days are listed.
const CHECK_WARN_DAYS = 60;

const KINDS = {
  assessment: ['interrai', 'an-acc', 'falls-risk', 'pressure-risk', 'pain', 'nutrition', 'cognition', 'continence', 'behaviour'],
  incident: ['fall', 'behaviour', 'medication', 'skin', 'absence', 'death', 'complaint', 'other'],
  injury: ['none', 'minor', 'needs-treatment'],
  sirs: ['unreasonable-force', 'unlawful-sexual-contact', 'psychological-abuse', 'unexpected-death', 'stealing-or-financial-coercion', 'neglect', 'restrictive-practice', 'unexplained-absence'],
  restrictive: ['chemical', 'environmental', 'mechanical', 'physical', 'seclusion'],
  wound: ['pressure-injury', 'skin-tear', 'ulcer', 'surgical', 'other'],
  stage: ['1', '2', '3', '4', 'unstageable', 'deep-tissue'],
  note: ['note', 'handover', 'gp', 'family', 'clinical', 'behaviour'],
};

// ---------------------------------------------------------------- arguments

const BOOL_FLAGS = new Set(['json', 'help', 'all', 'dry-run', 'respite', 'planned', 's31', 'conference', 'rep-attended', 'external', 'offsite', 'statement-to-rep']);

function parseArgv(argv) {
  const args = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h') { flags.help = true; continue; }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      let name, value;
      if (eq > -1) { name = a.slice(2, eq); value = a.slice(eq + 1); }
      else {
        name = a.slice(2);
        const next = argv[i + 1];
        if (BOOL_FLAGS.has(name) || next === undefined || next.startsWith('--')) value = true;
        else value = argv[++i];
      }
      flags[name] = value;
    } else args.push(a);
  }
  return { args, flags };
}

class CliError extends Error {
  constructor(message, code = 1) { super(message); this.code = code; }
}

const n = (v) => Number(v ?? 0);
const str = (v) => (v === true || v === undefined || v === null ? '' : String(v));
const r1 = (v) => Math.round(n(v) * 10) / 10;

function today() {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const addDays = (date, days) => { const d = new Date(`${date}T00:00:00`); d.setDate(d.getDate() + days); return isoDate(d); };
const daysBetween = (a, b) => Math.round((new Date(`${isoDate(b)}T00:00:00`) - new Date(`${isoDate(a)}T00:00:00`)) / 86400000);

function parseDate(v, what = 'date') {
  if (!v || v === true) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (s.toLowerCase() === 'today') return today();
  if (s.toLowerCase() === 'yesterday') return addDays(today(), -1);
  // Australian and New Zealand exports write DD/MM/YYYY.
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  throw new CliError(`"${v}" is not a ${what}. Use YYYY-MM-DD.`);
}

// "2026-10-24 14:30", "24/10/2026 2:30pm", "now", "today" are all times. Read in the machine's zone.
function parseTime(v, what = 'time') {
  if (!v || v === true) return null;
  const s = String(v).trim();
  if (s.toLowerCase() === 'now') return new Date();
  const m = s.match(/^(.+?)[ T](\d{1,2})[:.](\d{2})\s*(am|pm)?$/i);
  const datePart = parseDate(m ? m[1] : s, what);
  let h = m ? Number(m[2]) : 0;
  const min = m ? Number(m[3]) : 0;
  if (m && m[4]) { if (m[4].toLowerCase() === 'pm' && h < 12) h += 12; if (m[4].toLowerCase() === 'am' && h === 12) h = 0; }
  const d = new Date(`${datePart}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`);
  if (Number.isNaN(d.getTime())) throw new CliError(`"${v}" is not a ${what}.`);
  return d;
}

function oneOf(v, list, what) {
  const s = str(v).toLowerCase();
  if (!list.includes(s)) throw new CliError(`"${v}" is not a ${what}. Use one of: ${list.join(', ')}`);
  return s;
}

// ---------------------------------------------------------------- lookups

let db;
let JSON_OUT = false;

function ambiguous(what, rows, label) {
  return new CliError(`More than one ${what} matches. Be more specific:\n${rows.map((r) => `  ${label(r)}`).join('\n')}`);
}

async function findHome(ref) {
  if (!ref || ref === true) throw new CliError('Which home? Give its code (WATTLE) or part of its name.');
  const rows = await db.query(`select * from homes where lower(code) = lower($1) or name ilike $2 order by code`, [ref, `%${ref}%`]);
  const exact = rows.filter((r) => r.code.toLowerCase() === String(ref).toLowerCase());
  if (exact.length === 1) return exact[0];
  if (rows.length === 1) return rows[0];
  if (!rows.length) throw new CliError(`No home "${ref}". Run: ac homes`);
  throw ambiguous('home', rows, (r) => `${r.code}  ${r.name}`);
}

async function findResident(ref, { any = false } = {}) {
  if (!ref || ref === true) throw new CliError('Which resident? Give their code (W03) or part of their name.');
  const rows = await db.query(`select r.*, h.code as home, h.jurisdiction from residents r join homes h on h.id = r.home_id
    where (lower(r.code) = lower($1) or (r.first_name || ' ' || r.last_name) ilike $2 or r.last_name ilike $2)
      ${any ? '' : "and r.status in ('permanent', 'respite', 'in-hospital')"} order by r.code`, [ref, `%${ref}%`]);
  const exact = rows.filter((r) => r.code.toLowerCase() === String(ref).toLowerCase());
  if (exact.length === 1) return exact[0];
  if (rows.length === 1) return rows[0];
  if (!rows.length) throw new CliError(`No current resident "${ref}". Run: ac residents`);
  throw ambiguous('resident', rows, (r) => `${r.code}  ${r.first_name} ${r.last_name}  (${r.home}, room ${r.room || '?'})`);
}

async function findStaff(ref) {
  if (!ref || ref === true) return null;
  const rows = await db.query(`select * from staff where lower(code) = lower($1) or full_name ilike $2 order by code`, [ref, `%${ref}%`]);
  const exact = rows.filter((r) => r.code.toLowerCase() === String(ref).toLowerCase());
  if (exact.length === 1) return exact[0];
  if (rows.length === 1) return rows[0];
  if (!rows.length) throw new CliError(`No staff member "${ref}". Run: ac staff`);
  throw ambiguous('staff member', rows, (r) => `${r.code}  ${r.full_name} (${r.role})`);
}

async function findIncident(ref) {
  if (!ref || ref === true) throw new CliError('Which incident? Give its reference (INC-2026-0141) or the last digits.');
  const rows = await db.query(`select * from incidents where lower(reference) = lower($1) or reference ilike $2 order by reference`, [ref, `%${ref}`]);
  if (rows.length === 1) return rows[0];
  if (!rows.length) throw new CliError(`No incident "${ref}". Run: ac incidents --all`);
  throw ambiguous('incident', rows, (r) => `${r.reference}  ${truncate(r.description, 60)}`);
}

function out(data, human) {
  if (JSON_OUT) console.log(JSON.stringify(data, null, 2));
  else console.log(typeof human === 'function' ? human(data) : human);
}

const nameOf = (r) => `${r.first_name} ${r.last_name}`;
const isAU = (j) => j !== 'NZ';

// ---------------------------------------------------------------- overview

async function homes() {
  const rows = await db.query(`
    select h.code, h.name, h.jurisdiction, h.beds,
      (select count(*) from residents r where r.home_id = h.id and r.status in ('permanent', 'respite', 'in-hospital')) as residents,
      (select count(*) from incidents i where i.home_id = h.id and i.closed_on is null) as open_incidents,
      (select count(*) from restrictive_status p where p.home = h.code) as restrictive_practices,
      (select count(*) from wound_status w where w.home = h.code) as open_wounds,
      h.manager
    from homes h order by h.code`);
  const minutes = await careMinutesRows(CARE_MINUTES_DAYS);
  const data = rows.map((r) => {
    const m = minutes.find((x) => x.home === r.code);
    return { home: r.code, name: r.name, where: r.jurisdiction, beds: r.beds, residents: n(r.residents), occupancy_pct: Math.round((n(r.residents) / r.beds) * 100),
      care_minutes: m ? m.total_per_resident : null, care_minutes_target: m ? m.care_minutes_target : null,
      rn_minutes: m ? m.rn_per_resident : null, rn_minutes_target: m ? m.rn_minutes_target : null,
      open_incidents: n(r.open_incidents), restrictive_practices: n(r.restrictive_practices), open_wounds: n(r.open_wounds), manager: r.manager };
  });
  out(data, () => heading('Homes') + '\n' + table(data, [
    { key: 'home', label: 'Home' }, { key: 'name', label: 'Name' }, { key: 'where', label: 'Where' },
    { key: 'residents', label: 'Residents', align: 'right', format: (v, r) => `${v}/${r.beds}` },
    { key: 'care_minutes', label: 'Care min', align: 'right', format: (v, r) => (r.care_minutes_target ? `${v}/${r.care_minutes_target}` : 'n/a') },
    { key: 'rn_minutes', label: 'RN min', align: 'right', format: (v, r) => (r.rn_minutes_target ? `${v}/${r.rn_minutes_target}` : 'n/a') },
    { key: 'open_incidents', label: 'Open incidents', align: 'right' }, { key: 'restrictive_practices', label: 'Restrictive', align: 'right' },
    { key: 'open_wounds', label: 'Wounds', align: 'right' }, { key: 'manager', label: 'Manager' },
  ]) + `\n\n  Care and RN minutes are per resident per day over the last ${CARE_MINUTES_DAYS} days, against the home's target.`);
}

async function stats() {
  const [s] = await db.query(`select
    (select count(*) from homes) as homes, (select sum(beds) from homes) as beds,
    (select count(*) from residents where status in ('permanent', 'respite', 'in-hospital')) as residents,
    (select count(*) from residents where status = 'in-hospital') as in_hospital,
    (select count(*) from incidents where closed_on is null) as open_incidents,
    (select count(*) from incident_clock where report_late and reported_at is null) as late_reports,
    (select count(*) from restrictive_status) as restrictive_practices,
    (select count(*) from wound_status) as open_wounds`);
  const checks = await runChecks();
  const data = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, n(v)]));
  data.occupancy_pct = Math.round((data.residents / data.beds) * 100);
  data.breaches = checks.reduce((a, c) => a + c.count, 0);
  data.rules_breached = checks.filter((c) => c.count).length;
  out(data, (d) => [
    heading('The group'),
    `  ${d.homes} homes, ${d.residents} residents in ${d.beds} beds (${d.occupancy_pct}%), ${d.in_hospital} in hospital`,
    `  ${d.open_incidents} open incidents, ${d.late_reports} reportable incident(s) past the reporting deadline`,
    `  ${d.restrictive_practices} restrictive practices in use, ${d.open_wounds} open wounds`,
    `  ${d.breaches} compliance finding(s) across ${d.rules_breached} rule(s): run compliance`,
  ].join('\n'));
}

async function residents(flags) {
  const params = [];
  let where = '';
  if (flags.home) { const h = await findHome(flags.home); params.push(h.code); where = 'where home = $1'; }
  const rows = await db.query(`select code, name, home, room, status, care_level, admitted_on, days_here, latest_kg, alerts from resident_status ${where} order by home, code`, params);
  out(rows, () => heading('Residents') + '\n' + table(rows, [
    { key: 'code', label: 'Code' }, { key: 'name', label: 'Name' }, { key: 'home', label: 'Home' }, { key: 'room', label: 'Room' },
    { key: 'status', label: 'Status' }, { key: 'care_level', label: 'Level' }, { key: 'days_here', label: 'Days', align: 'right' },
    { key: 'latest_kg', label: 'Kg', align: 'right' }, { key: 'alerts', label: 'Alerts', width: 44 },
  ]));
}

async function residentCard(args) {
  const r = await findResident(args[0], { any: true });
  const [assess, plans, weights, wounds, incidents, restrictive, transfers, notes] = await Promise.all([
    db.query(`select kind, done_on, score, outcome, next_due_on from assessments where resident_id = $1 order by done_on desc`, [r.id]),
    db.query(`select reviewed_on, case_conference, representative_attended, summary, next_due_on from care_plan_reviews where resident_id = $1 order by reviewed_on desc limit 4`, [r.id]),
    db.query(`select weighed_on, kg, planned_loss from weights where resident_id = $1 order by weighed_on desc limit 6`, [r.id]),
    db.query(`select kind, stage, site, found_on, next_dressing_on, healed_on from wounds where resident_id = $1 order by found_on desc`, [r.id]),
    db.query(`select reference, occurred_at, kind, injury, sirs_type, sirs_priority, reported_at, closed_on, description from incidents where resident_id = $1 order by occurred_at desc`, [r.id]),
    db.query(`select kind, description, started_on, ended_on, consent_from, consent_on, behaviour_support_plan_on, review_due_on from restrictive_practices where resident_id = $1 order by started_on desc`, [r.id]),
    db.query(`select left_on, kind, reason, returned_on from hospital_transfers where resident_id = $1 order by left_on desc`, [r.id]),
    db.query(`select p.written_at, s.code as by, p.kind, p.body from progress_notes p left join staff s on s.id = p.written_by where p.resident_id = $1 order by p.written_at desc limit 6`, [r.id]),
  ]);
  const data = { resident: { code: r.code, name: nameOf(r), home: r.home, room: r.room, status: r.status, care_level: r.care_level, admitted_on: r.admitted_on, born_on: r.born_on,
    gp: r.gp, representative: r.representative, statement_to_representative: r.statement_to_representative, advance_care_plan: r.advance_care_plan,
    regular_medicines: r.regular_medicines, antipsychotic: r.antipsychotic, alerts: r.alerts }, assessments: assess, care_plans: plans, weights, wounds, incidents, restrictive, transfers, notes };
  out(data, (d) => [
    heading(`${r.code} ${nameOf(r)}`),
    `  ${r.home} room ${r.room || '?'}, ${r.status}, ${r.care_level || 'level not set'}, admitted ${isoDate(r.admitted_on)} (${daysBetween(r.admitted_on, today())} days)`,
    `  GP ${r.gp || 'not recorded'}. Representative ${r.representative || 'not recorded'}${r.statement_to_representative ? ' (gets the monthly care statement)' : ''}. Advance care plan: ${r.advance_care_plan ? 'yes' : 'no'}.`,
    `  ${r.regular_medicines ?? '?'} regular medicines${r.antipsychotic ? ', on an antipsychotic' : ''}.${r.alerts ? ' Alerts: ' + r.alerts : ''}`,
    '\nAssessments', table(d.assessments, [{ key: 'kind', label: 'Kind' }, { key: 'done_on', label: 'Done', format: isoDate }, { key: 'score', label: 'Score' }, { key: 'outcome', label: 'Outcome', width: 40 }, { key: 'next_due_on', label: 'Next due', format: isoDate }]),
    '\nCare plan reviews', table(d.care_plans, [{ key: 'reviewed_on', label: 'Reviewed', format: isoDate }, { key: 'case_conference', label: 'Case conf', format: (v) => (v ? 'yes' : '') }, { key: 'summary', label: 'Summary', width: 60 }, { key: 'next_due_on', label: 'Next due', format: isoDate }]),
    '\nWeights', table(d.weights, [{ key: 'weighed_on', label: 'Date', format: isoDate }, { key: 'kg', label: 'Kg', align: 'right' }]),
    '\nWounds', table(d.wounds, [{ key: 'kind', label: 'Kind' }, { key: 'stage', label: 'Stage' }, { key: 'site', label: 'Site' }, { key: 'found_on', label: 'Found', format: isoDate }, { key: 'healed_on', label: 'Healed', format: isoDate }]),
    '\nIncidents', table(d.incidents, [{ key: 'reference', label: 'Ref' }, { key: 'occurred_at', label: 'When', format: dateTime }, { key: 'kind', label: 'Kind' }, { key: 'injury', label: 'Injury' }, { key: 'sirs_type', label: 'SIRS' }, { key: 'description', label: 'What happened', width: 50 }]),
    '\nRestrictive practices', table(d.restrictive, [{ key: 'kind', label: 'Kind' }, { key: 'description', label: 'What', width: 44 }, { key: 'started_on', label: 'Since', format: isoDate }, { key: 'consent_on', label: 'Consent', format: isoDate }, { key: 'review_due_on', label: 'Review due', format: isoDate }]),
    '\nHospital', table(d.transfers, [{ key: 'left_on', label: 'Left', format: isoDate }, { key: 'kind', label: 'Kind' }, { key: 'reason', label: 'Reason' }, { key: 'returned_on', label: 'Back', format: isoDate }]),
    '\nLatest notes', table(d.notes, [{ key: 'written_at', label: 'When', format: dateTime }, { key: 'by', label: 'By' }, { key: 'kind', label: 'Kind' }, { key: 'body', label: 'Note', width: 70 }]),
  ].join('\n'));
}

async function staffList(flags) {
  const params = [];
  let where = 'where s.left_on is null';
  if (flags.home) { const h = await findHome(flags.home); params.push(h.id); where += ' and s.home_id = $1'; }
  const rows = await db.query(`select s.code, s.full_name, s.role, h.code as home, s.registration_no, s.registration_expires_on, s.screening_expires_on, s.interrai_trained
    from staff s left join homes h on h.id = s.home_id ${where} order by h.code, s.role, s.code`, params);
  out(rows, () => heading('Staff') + '\n' + table(rows, [
    { key: 'code', label: 'Code' }, { key: 'full_name', label: 'Name' }, { key: 'role', label: 'Role' }, { key: 'home', label: 'Home' },
    { key: 'registration_expires_on', label: 'Registration to', format: isoDate }, { key: 'screening_expires_on', label: 'Police check to', format: isoDate },
    { key: 'interrai_trained', label: 'interRAI', format: (v) => (v ? 'yes' : '') },
  ]));
}

// ---------------------------------------------------------------- residents in and out

async function admit(args, flags) {
  const h = await findHome(args[0]);
  const full = str(args[1]).trim();
  if (!full.includes(' ')) throw new CliError('ac admit <home> "First Last" [--room] [--level] [--date] [--respite] [--gp] [--rep] [--rep-email] [--born]');
  const first = full.split(' ')[0];
  const last = full.slice(first.length + 1);
  const prefix = h.code[0];
  const [{ next }] = await db.query(`select coalesce(max(substring(code from 2)::int), 0) + 1 as next from residents where code ~ ('^' || $1 || '[0-9]+$')`, [prefix]);
  const code = `${prefix}${String(next).padStart(2, '0')}`;
  const admitted = parseDate(flags.date) || today();
  const [row] = await db.query(`insert into residents (home_id, code, first_name, last_name, born_on, room, admitted_on, status, care_level, gp, representative, representative_email, statement_to_representative)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *`,
  [h.id, code, first, last, parseDate(flags.born, 'birth date'), str(flags.room) || null, admitted, flags.respite ? 'respite' : 'permanent', str(flags.level) || null,
    str(flags.gp) || null, str(flags.rep) || null, str(flags['rep-email']) || null, !!flags['statement-to-rep']]);
  const due = h.jurisdiction === 'NZ'
    ? [`interRAI and long-term care plan by ${addDays(admitted, NZ_FIRST_DAYS)}`]
    : [`care plan within ${CARE_PLAN_REVIEW_DAYS} days, review by ${addDays(admitted, CARE_PLAN_REVIEW_DAYS)}`];
  out({ code: row.code, name: nameOf(row), home: h.code, admitted_on: admitted, due }, (d) => `  Admitted ${d.code} ${d.name} to ${d.home} on ${d.admitted_on}. Next: ${d.due.join('; ')}.`);
}

async function discharge(args, flags) {
  const r = await findResident(args[0]);
  const reason = flags.reason ? oneOf(flags.reason, ['discharged', 'deceased'], 'reason') : 'discharged';
  const on = parseDate(flags.date) || today();
  await db.query(`update residents set status = $2, left_on = $3 where id = $1`, [r.id, reason, on]);
  await db.query(`update restrictive_practices set ended_on = $2 where resident_id = $1 and ended_on is null`, [r.id, on]);
  out({ code: r.code, status: reason, left_on: on }, (d) => `  ${d.code} ${nameOf(r)} ${d.status} on ${d.left_on}. Restrictive practices ended.${reason === 'deceased' ? ' If the death was unexpected it is a Priority 1 SIRS incident: record it with incident.' : ''}`);
}

async function hospital(args, flags) {
  const r = await findResident(args[0]);
  const kind = flags.kind ? (str(flags.kind).toLowerCase().startsWith('e') ? 'emergency-department' : oneOf(flags.kind, ['admitted'], 'kind')) : 'emergency-department';
  const on = parseDate(flags.date) || today();
  await db.query(`insert into hospital_transfers (resident_id, left_on, kind, reason) values ($1,$2,$3,$4)
    on conflict (resident_id, left_on) do update set kind = excluded.kind, reason = excluded.reason`, [r.id, on, kind, str(flags.reason) || null]);
  if (kind === 'admitted') await db.query(`update residents set status = 'in-hospital' where id = $1`, [r.id]);
  out({ code: r.code, left_on: on, kind }, (d) => `  ${d.code} ${nameOf(r)} to hospital (${d.kind}) on ${d.left_on}.`);
}

async function returned(args, flags) {
  const r = await findResident(args[0]);
  const on = parseDate(flags.date) || today();
  const rows = await db.query(`update hospital_transfers set returned_on = $2 where id = (select id from hospital_transfers where resident_id = $1 and returned_on is null order by left_on desc limit 1) returning *`, [r.id, on]);
  if (!rows.length) throw new CliError(`${r.code} has no open hospital transfer.`);
  if (r.status === 'in-hospital') await db.query(`update residents set status = 'permanent' where id = $1`, [r.id]);
  out({ code: r.code, returned_on: on, days_away: daysBetween(rows[0].left_on, on) }, (d) => `  ${d.code} back from hospital on ${d.returned_on} after ${d.days_away} day(s). Review the care plan and any medication changes.`);
}

async function log(args, flags) {
  const r = await findResident(args[0]);
  const body = str(args[1]).trim();
  if (!body) throw new CliError('ac log <resident> "note" [--kind=note|handover|gp|family|clinical|behaviour] [--by=STAFF]');
  const kind = flags.kind ? oneOf(flags.kind, KINDS.note, 'note kind') : 'note';
  const by = await findStaff(flags.by);
  const [row] = await db.query(`insert into progress_notes (resident_id, written_by, kind, body) values ($1,$2,$3,$4) returning written_at`, [r.id, by?.id || null, kind, body]);
  out({ code: r.code, kind, written_at: row.written_at }, () => `  Noted on ${r.code} ${nameOf(r)} (${kind}).`);
}

// ---------------------------------------------------------------- assessments and care plans

async function assessmentsDue(flags) {
  const days = Number(flags.due || DUE_SOON_DAYS);
  const params = [days];
  let homeFilter = '';
  if (flags.home) { const h = await findHome(flags.home); params.push(h.code); homeFilter = 'and x.home = $2'; }
  const rows = await db.query(`
    with latest as (
      select distinct on (a.resident_id, a.kind) a.resident_id, a.kind, a.done_on, a.next_due_on from assessments a order by a.resident_id, a.kind, a.done_on desc
    ), due as (
      select s.code, s.name, s.home, s.jurisdiction, l.kind, l.done_on, l.next_due_on as due_on from latest l join resident_status s on s.resident_id = l.resident_id where l.next_due_on is not null
      union all
      select s.code, s.name, s.home, s.jurisdiction, 'interrai (first)', null, s.admitted_on + ${NZ_FIRST_DAYS} from resident_status s
      where s.jurisdiction = 'NZ' and s.status <> 'respite' and not exists (select 1 from assessments a where a.resident_id = s.resident_id and a.kind = 'interrai' and a.done_on >= s.admitted_on)
    )
    select x.*, x.due_on - current_date as days_left from due x where x.due_on <= current_date + $1::int ${homeFilter} order by x.due_on, x.code`, params);
  out(rows, () => heading(`Assessments due within ${days} days or overdue`) + '\n' + table(rows, [
    { key: 'code', label: 'Code' }, { key: 'name', label: 'Resident' }, { key: 'home', label: 'Home' }, { key: 'kind', label: 'Assessment' },
    { key: 'done_on', label: 'Last done', format: isoDate }, { key: 'due_on', label: 'Due', format: isoDate },
    { key: 'days_left', label: 'Days', align: 'right', format: (v) => (n(v) < 0 ? `${-n(v)} late` : v) },
  ]));
}

async function assess(args, flags) {
  const r = await findResident(args[0]);
  const kind = oneOf(args[1], KINDS.assessment, 'assessment kind');
  const on = parseDate(flags.date) || today();
  const next = parseDate(flags.next, 'next due date') || addDays(on, kind === 'interrai' ? INTERRAI_CYCLE_DAYS : 90);
  const by = await findStaff(flags.by);
  await db.query(`insert into assessments (resident_id, kind, done_on, done_by, score, outcome, next_due_on) values ($1,$2,$3,$4,$5,$6,$7)
    on conflict (resident_id, kind, done_on) do update set score = excluded.score, outcome = excluded.outcome, next_due_on = excluded.next_due_on, done_by = excluded.done_by`,
  [r.id, kind, on, by?.id || null, str(flags.score) || null, str(flags.outcome) || null, next]);
  out({ code: r.code, kind, done_on: on, next_due_on: next }, (d) => `  ${d.kind} for ${d.code} ${nameOf(r)} recorded ${d.done_on}. Next due ${d.next_due_on}.`);
}

async function carePlansDue(flags) {
  const days = Number(flags.due || DUE_SOON_DAYS);
  const rows = await db.query(`
    select code, name, home, jurisdiction, admitted_on, last_care_plan_on,
      coalesce(care_plan_due_on, admitted_on + case when jurisdiction = 'NZ' then ${NZ_FIRST_DAYS} else ${CARE_PLAN_REVIEW_DAYS} end) as due_on
    from resident_status where status <> 'respite'`);
  const data = rows.map((r) => ({ ...r, due_on: isoDate(r.due_on), days_left: daysBetween(today(), r.due_on), first: !r.last_care_plan_on }))
    .filter((r) => r.days_left <= days).sort((a, b) => a.days_left - b.days_left);
  out(data, () => heading(`Care plan reviews due within ${days} days or overdue`) + '\n' + table(data, [
    { key: 'code', label: 'Code' }, { key: 'name', label: 'Resident' }, { key: 'home', label: 'Home' },
    { key: 'last_care_plan_on', label: 'Last review', format: (v) => (v ? isoDate(v) : 'none yet') }, { key: 'due_on', label: 'Due' },
    { key: 'days_left', label: 'Days', align: 'right', format: (v) => (v < 0 ? `${-v} late` : v) },
  ]));
}

async function review(args, flags) {
  const r = await findResident(args[0]);
  const on = parseDate(flags.date) || today();
  const next = parseDate(flags.next, 'next review date') || addDays(on, r.jurisdiction === 'NZ' ? INTERRAI_CYCLE_DAYS : CARE_PLAN_REVIEW_DAYS);
  const by = await findStaff(flags.by);
  await db.query(`insert into care_plan_reviews (resident_id, reviewed_on, reviewed_by, case_conference, representative_attended, summary, next_due_on) values ($1,$2,$3,$4,$5,$6,$7)
    on conflict (resident_id, reviewed_on) do update set summary = excluded.summary, next_due_on = excluded.next_due_on, case_conference = excluded.case_conference, representative_attended = excluded.representative_attended`,
  [r.id, on, by?.id || null, !!flags.conference, !!flags['rep-attended'], str(flags.summary) || null, next]);
  out({ code: r.code, reviewed_on: on, next_due_on: next }, (d) => `  Care plan for ${d.code} ${nameOf(r)} reviewed ${d.reviewed_on}. Next review ${d.next_due_on}.`);
}

// ---------------------------------------------------------------- clinical: weights, wounds, falls

async function weightRows(loss) {
  const rows = await db.query(`select * from weight_trend order by code`);
  const series = await db.query(`select r.code, w.kg from weights w join residents r on r.id = w.resident_id where w.weighed_on >= current_date - 100 order by r.code, w.weighed_on`);
  const by = {};
  for (const s of series) (by[s.code] ||= []).push(n(s.kg));
  return rows.map((r) => {
    const kgs = by[r.code] || [];
    const lastFour = kgs.slice(-4);
    const consecutive = lastFour.length === 4 && lastFour.every((k, i) => i === 0 || k < lastFour[i - 1]);
    return { code: r.code, name: r.name, home: r.home, earlier_on: isoDate(r.earlier_on), earlier_kg: r.earlier_kg === null ? null : n(r.earlier_kg), latest_on: isoDate(r.latest_on), latest_kg: n(r.latest_kg),
      change_kg: r.earlier_kg === null ? null : r1(n(r.latest_kg) - n(r.earlier_kg)), change_pct: r.change_pct === null ? null : n(r.change_pct), planned: r.planned_loss, consecutive_loss: consecutive,
      significant: r.change_pct !== null && n(r.change_pct) <= -loss && !r.planned_loss };
  });
}

async function weights(flags) {
  const loss = Number(flags.loss || WEIGHT_LOSS_PCT);
  const all = await weightRows(loss);
  const rows = flags.all ? all : all.filter((r) => r.significant || r.consecutive_loss);
  out(rows, () => heading(flags.all ? 'Weights, about three months apart' : `Unplanned weight loss of ${loss}% or more, or lower every month`) + '\n' + table(rows, [
    { key: 'code', label: 'Code' }, { key: 'name', label: 'Resident' }, { key: 'home', label: 'Home' },
    { key: 'earlier_kg', label: 'Then', align: 'right' }, { key: 'latest_kg', label: 'Now', align: 'right' },
    { key: 'change_kg', label: 'Kg', align: 'right' }, { key: 'change_pct', label: '%', align: 'right' },
    { key: 'consecutive_loss', label: 'Every month lower', format: (v) => (v ? 'yes' : '') },
  ]));
}

async function weigh(args, flags) {
  const r = await findResident(args[0]);
  const kg = Number(args[1]);
  if (!Number.isFinite(kg) || kg <= 0 || kg > 300) throw new CliError('ac weigh <resident> <kg> [--date] [--planned]');
  const on = parseDate(flags.date) || today();
  await db.query(`insert into weights (resident_id, weighed_on, kg, planned_loss) values ($1,$2,$3,$4) on conflict (resident_id, weighed_on) do update set kg = excluded.kg, planned_loss = excluded.planned_loss`, [r.id, on, kg, !!flags.planned]);
  const trend = (await weightRows(WEIGHT_LOSS_PCT)).find((t) => t.code === r.code);
  out({ code: r.code, weighed_on: on, kg, trend }, (d) => `  ${d.code} ${nameOf(r)} ${d.kg}kg on ${d.weighed_on}.${d.trend?.change_pct !== null && d.trend?.change_pct !== undefined ? ` ${d.trend.change_pct}% against ${d.trend.earlier_on}.` : ''}${d.trend?.significant ? ' Significant unplanned loss: tell the GP and the dietitian.' : ''}`);
}

async function wounds(flags) {
  const rows = await db.query(`select * from wound_status ${flags.home ? 'where home = $1' : ''} order by home, resident`, flags.home ? [(await findHome(flags.home)).code] : []);
  out(rows, () => heading('Open wounds') + '\n' + table(rows, [
    { key: 'resident', label: 'Code' }, { key: 'name', label: 'Resident' }, { key: 'home', label: 'Home' }, { key: 'kind', label: 'Kind' }, { key: 'stage', label: 'Stage' },
    { key: 'site', label: 'Site' }, { key: 'days_open', label: 'Days', align: 'right' }, { key: 'acquired_here', label: 'Here', format: (v) => (v ? 'yes' : 'admitted with') },
    { key: 'next_dressing_on', label: 'Next dressing', format: (v, r) => `${isoDate(v)}${r.dressing_overdue ? ' OVERDUE' : ''}` },
  ]));
}

async function wound(args, flags) {
  const r = await findResident(args[0]);
  const kind = oneOf(args[1], KINDS.wound, 'wound kind');
  const site = str(args[2]).trim();
  if (!site) throw new CliError('ac wound <resident> <kind> "site" [--stage] [--date] [--dressing=date] [--external]');
  const stage = flags.stage ? oneOf(flags.stage, KINDS.stage, 'stage') : null;
  const on = parseDate(flags.date) || today();
  await db.query(`insert into wounds (resident_id, kind, stage, site, found_on, acquired_here, next_dressing_on) values ($1,$2,$3,$4,$5,$6,$7)
    on conflict (resident_id, site, found_on) do update set stage = excluded.stage, next_dressing_on = excluded.next_dressing_on`,
  [r.id, kind, stage, site, on, !flags.external, parseDate(flags.dressing, 'dressing date')]);
  // HealthCERT asks for every pressure injury at stage 3 or worse, wherever the resident developed it.
  const needsS31 = r.jurisdiction === 'NZ' && kind === 'pressure-injury' && ['3', '4', 'unstageable', 'deep-tissue'].includes(stage);
  out({ code: r.code, kind, stage, site, found_on: on, s31_likely: needsS31 }, (d) => `  ${d.kind}${d.stage ? ' stage ' + d.stage : ''} on ${d.site} recorded for ${d.code} ${nameOf(r)}.${d.s31_likely ? ' A New Zealand home notifies HealthCERT of every pressure injury at stage 3 or worse: record it with incident --s31.' : ''}`);
}

async function heal(args, flags) {
  const r = await findResident(args[0]);
  const site = str(args[1]).trim();
  const rows = await db.query(`update wounds set healed_on = $3 where resident_id = $1 and site ilike $2 and healed_on is null returning *`, [r.id, `%${site}%`, parseDate(flags.date) || today()]);
  if (!rows.length) throw new CliError(`${r.code} has no open wound on "${site}".`);
  out({ code: r.code, healed: rows.length }, () => `  ${rows.length} wound(s) on ${site} healed for ${r.code}.`);
}

async function falls(flags) {
  const days = Number(flags.days || FALLS_WINDOW_DAYS);
  const rows = await db.query(`select r.code, r.first_name || ' ' || r.last_name as name, h.code as home, count(*) as falls,
      count(*) filter (where i.injury = 'needs-treatment') as needing_treatment, max(i.occurred_at) as last_fall,
      string_agg(to_char(i.occurred_at, 'HH24:MI'), ', ' order by i.occurred_at) as times
    from incidents i join residents r on r.id = i.resident_id join homes h on h.id = i.home_id
    where i.kind = 'fall' and i.occurred_at >= now() - ($1 || ' days')::interval and r.status in ('permanent', 'respite', 'in-hospital')
    group by r.code, r.first_name, r.last_name, h.code order by count(*) desc, r.code`, [days]);
  const data = rows.map((r) => ({ ...r, falls: n(r.falls), needing_treatment: n(r.needing_treatment), repeat: n(r.falls) >= REPEAT_FALLS }));
  out(data, () => heading(`Falls in the last ${days} days`) + '\n' + table(data, [
    { key: 'code', label: 'Code' }, { key: 'name', label: 'Resident' }, { key: 'home', label: 'Home' }, { key: 'falls', label: 'Falls', align: 'right' },
    { key: 'needing_treatment', label: 'Needed treatment', align: 'right' }, { key: 'last_fall', label: 'Last', format: dateTime }, { key: 'times', label: 'Times of day' },
    { key: 'repeat', label: 'Repeat faller', format: (v) => (v ? 'yes' : '') },
  ]));
}

// ---------------------------------------------------------------- incidents and reporting clocks

async function incidents(flags) {
  const params = [];
  const where = [flags.all ? 'true' : 'closed_on is null'];
  if (flags.home) { params.push((await findHome(flags.home)).code); where.push(`home = $${params.length}`); }
  const rows = await db.query(`select * from incident_clock where ${where.join(' and ')} order by occurred_at desc`, params);
  const data = rows.map((r) => ({ reference: r.reference, home: r.home, resident: r.resident, kind: r.kind, injury: r.injury, occurred_at: r.occurred_at,
    sirs: r.sirs_priority ? `P${r.sirs_priority} ${r.sirs_type || '(type not set)'}` : r.s31_required ? 'Section 31' : '', report_due_at: r.report_due_at, reported_at: r.reported_at,
    open_disclosure_on: r.open_disclosure_on, flag: r.report_late && !r.reported_at ? 'REPORT LATE' : r.report_late ? 'reported late' : '', description: r.description }));
  out(data, () => heading(flags.all ? 'Incidents' : 'Open incidents') + '\n' + table(data, [
    { key: 'reference', label: 'Ref' }, { key: 'home', label: 'Home' }, { key: 'resident', label: 'Res' }, { key: 'kind', label: 'Kind' }, { key: 'injury', label: 'Injury' },
    { key: 'occurred_at', label: 'When', format: dateTime }, { key: 'sirs', label: 'Reportable' }, { key: 'reported_at', label: 'Reported', format: dateTime },
    { key: 'flag', label: 'Flag' }, { key: 'description', label: 'What happened', width: 48 },
  ]));
}

async function sirsRows() {
  const rows = await db.query(`select * from incident_clock where (sirs_priority is not null or s31_required) and (reported_at is null or reported_at > now() - interval '30 days') order by coalesce(report_due_at, aware_at)`);
  const now = Date.now();
  return rows.map((r) => {
    const due = r.report_due_at ? new Date(r.report_due_at) : r.s31_required ? new Date(new Date(r.aware_at).getTime() + S31_WAIT_HOURS * 3600000) : null;
    const hoursLeft = due ? Math.round((due.getTime() - now) / 3600000) : null;
    const scheme = r.sirs_priority ? `SIRS Priority ${r.sirs_priority}` : 'Section 31 (HealthCERT)';
    let flag = '';
    if (!r.reported_at && hoursLeft !== null && hoursLeft < 0) flag = 'PAST DUE';
    else if (!r.reported_at) flag = 'to report';
    else if (r.report_late) flag = 'reported late';
    return { reference: r.reference, home: r.home, resident: r.resident, scheme, type: r.sirs_type || r.kind, aware_at: r.aware_at, due_at: due, hours_left: r.reported_at ? null : hoursLeft,
      reported_at: r.reported_at, report_reference: r.report_reference, flag, description: r.description };
  });
}

async function sirs() {
  const rows = await sirsRows();
  out(rows, () => heading('Reportable incidents and their clocks') + '\n' + table(rows, [
    { key: 'reference', label: 'Ref' }, { key: 'home', label: 'Home' }, { key: 'resident', label: 'Res' }, { key: 'scheme', label: 'Scheme' }, { key: 'type', label: 'Type' },
    { key: 'aware_at', label: 'Aware', format: dateTime }, { key: 'due_at', label: 'Due', format: dateTime },
    { key: 'hours_left', label: 'Hours left', align: 'right', format: (v) => (v === null ? '' : v < 0 ? `${-v} over` : v) },
    { key: 'reported_at', label: 'Reported', format: dateTime }, { key: 'flag', label: 'Flag' },
  ]) + `\n\n  SIRS: Priority 1 within 24 hours of becoming aware, Priority 2 within 30 days. Section 31: flagged after ${S31_WAIT_HOURS} hours.`);
}

// Priority 1 when the incident caused, or could reasonably have caused, an injury needing medical or
// psychological treatment; always for unlawful sexual contact, an unexpected death, and an unexplained
// absence reported to police. Otherwise Priority 2.
function suggestPriority(type, injury, police) {
  if (!type) return null;
  if (injury === 'needs-treatment') return 1;
  if (['unlawful-sexual-contact', 'unexpected-death'].includes(type)) return 1;
  if (type === 'unexplained-absence' && police) return 1;
  return 2;
}

async function incidentNew(args, flags) {
  const h = await findHome(args[0]);
  const kind = oneOf(args[1], KINDS.incident, 'incident kind');
  const description = str(args[2]).trim();
  if (!description) throw new CliError('ac incident <home> <kind> "what happened" [--resident] [--occurred] [--aware] [--injury] [--sirs=type] [--priority=1|2] [--s31] [--police=time]');
  const r = flags.resident ? await findResident(flags.resident) : null;
  if (r && r.home !== h.code) throw new CliError(`${r.code} lives at ${r.home}, not ${h.code}.`);
  const occurred = parseTime(flags.occurred) || new Date();
  const aware = parseTime(flags.aware) || new Date();
  if (aware < occurred) throw new CliError('Aware cannot be before it happened.');
  const injury = flags.injury ? oneOf(flags.injury, KINDS.injury, 'injury') : 'none';
  const type = flags.sirs ? oneOf(flags.sirs, KINDS.sirs, 'SIRS type') : null;
  if (type && h.jurisdiction === 'NZ') throw new CliError('SIRS is an Australian scheme. In New Zealand use --s31 for a Section 31 notification.');
  if (flags.s31 && h.jurisdiction !== 'NZ') throw new CliError('Section 31 notifications are for New Zealand homes. Use --sirs in Australia.');
  const police = parseTime(flags.police, 'police time');
  const priority = flags.priority ? Number(oneOf(flags.priority, ['1', '2'], 'priority')) : suggestPriority(type, injury, police);
  const year = occurred.getFullYear();
  const [{ next }] = await db.query(`select coalesce(max(substring(reference from 10)::int), 0) + 1 as next from incidents where reference like $1`, [`INC-${year}-%`]);
  const reference = `INC-${year}-${String(next).padStart(4, '0')}`;
  const [row] = await db.query(`insert into incidents (home_id, resident_id, reference, occurred_at, aware_at, kind, injury, sirs_type, sirs_priority, s31_required, police_notified_at, description, actions)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *`,
  [h.id, r?.id || null, reference, occurred, aware, kind, injury, type, priority, !!flags.s31, police, description, str(flags.actions) || null]);
  const [clock] = await db.query(`select report_due_at from incident_clock where incident_id = $1`, [row.id]);
  out({ reference, home: h.code, resident: r?.code || null, sirs_type: type, sirs_priority: priority, s31_required: !!flags.s31, report_due_at: clock.report_due_at },
    (d) => `  ${d.reference} recorded at ${d.home}${d.resident ? ' for ' + d.resident : ''}.${d.sirs_priority ? ` SIRS Priority ${d.sirs_priority}: report by ${dateTime(d.report_due_at)}. Draft it with /draft-sirs-notice.` : ''}${d.s31_required ? ' Section 31: notify HealthCERT as soon as practicable.' : ''}`);
}

async function report(args, flags) {
  const i = await findIncident(args[0]);
  if (!i.sirs_priority && !i.s31_required) throw new CliError(`${i.reference} is not marked reportable.`);
  const at = parseTime(flags.at) || new Date();
  await db.query(`update incidents set reported_at = $2, report_reference = $3 where id = $1`, [i.id, at, str(flags.ref) || null]);
  const [c] = await db.query(`select report_late from incident_clock where incident_id = $1`, [i.id]);
  out({ reference: i.reference, reported_at: at, late: c.report_late }, (d) => `  ${d.reference} reported ${dateTime(d.reported_at)}${d.late ? ', after the deadline: note why on the incident' : ', in time'}.`);
}

async function disclose(args, flags) {
  const i = await findIncident(args[0]);
  const on = parseDate(flags.date) || today();
  await db.query(`update incidents set open_disclosure_on = $2 where id = $1`, [i.id, on]);
  out({ reference: i.reference, open_disclosure_on: on }, (d) => `  Open disclosure for ${d.reference} recorded ${d.open_disclosure_on}.`);
}

async function closeIncident(args, flags) {
  const i = await findIncident(args[0]);
  if ((i.sirs_priority || i.s31_required) && !i.reported_at) throw new CliError(`${i.reference} is reportable and has not been reported. Record the report first (report ${i.reference}).`);
  const on = parseDate(flags.date) || today();
  await db.query(`update incidents set closed_on = $2, actions = coalesce($3, actions) where id = $1`, [i.id, on, str(flags.actions) || null]);
  out({ reference: i.reference, closed_on: on }, (d) => `  ${d.reference} closed ${d.closed_on}.`);
}

// ---------------------------------------------------------------- restrictive practices

async function restrictive(flags) {
  const rows = await db.query(`select * from restrictive_status ${flags.home ? 'where home = $1' : ''} order by home, resident, kind`, flags.home ? [(await findHome(flags.home)).code] : []);
  const data = rows.map((r) => ({ ...r, missing: [r.no_consent && 'consent', r.no_plan && 'behaviour support plan', r.review_overdue && 'review overdue'].filter(Boolean).join(', ') }));
  out(data, () => heading('Restrictive practices in use') + '\n' + table(data, [
    { key: 'resident', label: 'Code' }, { key: 'name', label: 'Resident' }, { key: 'home', label: 'Home' }, { key: 'kind', label: 'Kind' },
    { key: 'description', label: 'What', width: 46 }, { key: 'started_on', label: 'Since', format: isoDate }, { key: 'consent_from', label: 'Consent from', width: 28 },
    { key: 'review_due_on', label: 'Review due', format: isoDate }, { key: 'missing', label: 'Missing' },
  ]));
}

async function restrict(args, flags) {
  const r = await findResident(args[0]);
  const kind = oneOf(args[1], KINDS.restrictive, 'restrictive practice kind');
  const description = str(args[2]).trim();
  const started = parseDate(flags.started) || today();
  const existing = await db.query(`select * from restrictive_practices where resident_id = $1 and kind = $2 and ended_on is null order by started_on desc limit 1`, [r.id, kind]);
  let row;
  if (existing.length && !description) {
    [row] = await db.query(`update restrictive_practices set consent_from = coalesce($2, consent_from), consent_on = coalesce($3, consent_on), prescriber = coalesce($4, prescriber),
      behaviour_support_plan_on = coalesce($5, behaviour_support_plan_on), review_due_on = coalesce($6, review_due_on) where id = $1 returning *`,
    [existing[0].id, str(flags['consent-from']) || null, parseDate(flags['consent-on'], 'consent date'), str(flags.prescriber) || null, parseDate(flags['plan-on'], 'plan date'), parseDate(flags['review-due'], 'review date')]);
  } else {
    if (!description) throw new CliError('ac restrict <resident> <kind> "what and why" [--started] [--consent-from] [--consent-on] [--prescriber] [--plan-on] [--review-due]. Leave out the description to update the one in use.');
    [row] = await db.query(`insert into restrictive_practices (resident_id, kind, description, started_on, consent_from, consent_on, prescriber, behaviour_support_plan_on, review_due_on)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
    [r.id, kind, description, started, str(flags['consent-from']) || null, parseDate(flags['consent-on'], 'consent date'), str(flags.prescriber) || null, parseDate(flags['plan-on'], 'plan date'), parseDate(flags['review-due'], 'review date')]);
  }
  const missing = [!row.consent_on && 'informed consent', !row.behaviour_support_plan_on && 'a behaviour support plan', !row.review_due_on && 'a review date'].filter(Boolean);
  out({ code: r.code, kind, started_on: row.started_on, missing }, (d) => `  ${d.kind} restrictive practice for ${d.code} ${nameOf(r)} since ${isoDate(d.started_on)}.${d.missing.length ? ' Still missing: ' + d.missing.join(', ') + '.' : ' Consent, plan and review date recorded.'}`);
}

async function restrictEnd(args, flags) {
  const r = await findResident(args[0]);
  const kind = oneOf(args[1], KINDS.restrictive, 'restrictive practice kind');
  const rows = await db.query(`update restrictive_practices set ended_on = $3 where resident_id = $1 and kind = $2 and ended_on is null returning *`, [r.id, kind, parseDate(flags.date) || today()]);
  if (!rows.length) throw new CliError(`${r.code} has no ${kind} restrictive practice in use.`);
  out({ code: r.code, kind, ended: rows.length }, () => `  ${kind} restrictive practice ended for ${r.code}.`);
}

// ---------------------------------------------------------------- workforce: care minutes, RN cover, checks

async function careMinutesRows(days, homeCode = null) {
  const rows = await db.query(`select home, jurisdiction, care_minutes_target, rn_minutes_target, count(*) as days, sum(residents) as resident_days,
      sum(rn_minutes) as rn, sum(en_minutes) as en, sum(pcw_minutes) as pcw
    from care_minutes_daily where day >= current_date - $1::int ${homeCode ? 'and home = $2' : ''}
    group by home, jurisdiction, care_minutes_target, rn_minutes_target order by home`, homeCode ? [days, homeCode] : [days]);
  return rows.map((r) => {
    const rd = n(r.resident_days) || 1;
    const rnTarget = r.rn_minutes_target === null ? null : n(r.rn_minutes_target);
    // Enrolled nurse minutes count toward the RN target up to 10% of it.
    const enCounted = rnTarget === null ? 0 : Math.min(n(r.en), rnTarget * 0.1 * rd);
    const total = (n(r.rn) + n(r.en) + n(r.pcw)) / rd;
    const rnPer = (n(r.rn) + enCounted) / rd;
    return { home: r.home, where: r.jurisdiction, days: n(r.days), average_residents: r1(rd / n(r.days)),
      total_per_resident: r1(total), care_minutes_target: r.care_minutes_target === null ? null : n(r.care_minutes_target),
      rn_per_resident: r1(rnPer), rn_minutes_target: rnTarget,
      total_met: r.care_minutes_target === null ? null : total >= n(r.care_minutes_target), rn_met: rnTarget === null ? null : rnPer >= rnTarget,
      total_short_minutes_per_day: r.care_minutes_target === null ? null : Math.max(0, Math.round((n(r.care_minutes_target) - total) * (rd / n(r.days)))) };
  });
}

async function careMinutes(flags) {
  const days = Number(flags.days || CARE_MINUTES_DAYS);
  const rows = await careMinutesRows(days, flags.home ? (await findHome(flags.home)).code : null);
  out(rows, () => heading(`Care minutes per resident per day, last ${days} days`) + '\n' + table(rows, [
    { key: 'home', label: 'Home' }, { key: 'where', label: 'Where' }, { key: 'average_residents', label: 'Residents', align: 'right' },
    { key: 'total_per_resident', label: 'Total', align: 'right' }, { key: 'care_minutes_target', label: 'Target', align: 'right', format: (v) => (v === null ? 'n/a' : v) },
    { key: 'rn_per_resident', label: 'RN', align: 'right' }, { key: 'rn_minutes_target', label: 'RN target', align: 'right', format: (v) => (v === null ? 'n/a' : v) },
    { key: 'total_met', label: 'Total', format: (v) => (v === null ? '' : v ? 'met' : 'UNDER') }, { key: 'rn_met', label: 'RN', format: (v) => (v === null ? '' : v ? 'met' : 'UNDER') },
    { key: 'total_short_minutes_per_day', label: 'Short min/day', align: 'right', format: (v) => (v ? v : '') },
  ]) + '\n\n  Registered, enrolled and personal care worker minutes count. Enrolled nurse minutes count toward the RN target up to 10% of it.\n  The target is met on average over each quarter; this reads the last ' + days + ' days so you see it coming.');
}

const toMin = (ts) => { const s = String(ts); return new Date(`${s.slice(0, 10)}T${s.slice(11, 19) || '00:00:00'}Z`).getTime() / 60000; };

async function rnCoverRows(days, all = false) {
  const homesRows = await db.query(`select id, code, jurisdiction from homes order by code`);
  const shifts = await db.query(`select home_id, starts_at::text as s, ends_at::text as e from shifts where role = 'RN' and ends_at >= current_date - $1::int and starts_at < current_date order by starts_at`, [days + 1]);
  const [{ d0 }] = await db.query(`select (current_date - $1::int)::text as d0`, [days]);
  const gaps = [];
  for (const h of homesRows) {
    if (!all && !isAU(h.jurisdiction)) continue;
    const iv = shifts.filter((s) => s.home_id === h.id).map((s) => [toMin(s.s), toMin(s.e)]).sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < days; i++) {
      const day = addDays(d0, i);
      const start = toMin(`${day} 00:00:00`);
      const end = start + 1440;
      let cursor = start;
      for (const [a, b] of iv) {
        if (b <= cursor || a >= end) continue;
        if (a > cursor) gaps.push({ home: h.code, day, from: minToClock(cursor - start), to: minToClock(Math.min(a, end) - start), minutes: Math.min(a, end) - cursor });
        cursor = Math.max(cursor, b);
        if (cursor >= end) break;
      }
      if (cursor < end) gaps.push({ home: h.code, day, from: minToClock(cursor - start), to: '24:00', minutes: end - cursor });
    }
  }
  return gaps;
}
const minToClock = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

async function rnCover(flags) {
  const days = Number(flags.days || RN_COVER_DAYS);
  const rows = await rnCoverRows(days, !!flags.all);
  out(rows, () => heading(`Hours with no registered nurse on site, last ${days} days`) + '\n' + table(rows, [
    { key: 'home', label: 'Home' }, { key: 'day', label: 'Day' }, { key: 'from', label: 'From' }, { key: 'to', label: 'To' }, { key: 'minutes', label: 'Minutes', align: 'right' },
  ]) + `\n\n  Read from the RN shifts on the roster. ${flags.all ? '' : 'Australian homes only (the 24/7 RN rule); add --all for every home.'}`);
}

async function staffChecks(flags) {
  const days = Number(flags.days || CHECK_WARN_DAYS);
  const rows = await db.query(`select * from staff_checks where registration_days_left <= $1 or screening_days_left <= $1 order by least(coalesce(registration_days_left, 99999), coalesce(screening_days_left, 99999))`, [days]);
  const data = rows.map((r) => ({ ...r, registration_days_left: r.registration_days_left === null ? null : n(r.registration_days_left), screening_days_left: r.screening_days_left === null ? null : n(r.screening_days_left),
    rostered_recently: !!r.last_shift_on && daysBetween(r.last_shift_on, today()) <= RN_COVER_DAYS }));
  const fmt = (v) => (v === null ? '' : v < 0 ? `EXPIRED ${-v}d ago` : `${v} days`);
  out(data, () => heading(`Registrations and police checks expiring within ${days} days`) + '\n' + table(data, [
    { key: 'code', label: 'Code' }, { key: 'full_name', label: 'Name' }, { key: 'role', label: 'Role' }, { key: 'home', label: 'Home' },
    { key: 'registration_expires_on', label: 'Registration', format: isoDate }, { key: 'registration_days_left', label: 'Left', format: fmt },
    { key: 'screening_expires_on', label: 'Police check', format: isoDate }, { key: 'screening_days_left', label: 'Left', format: fmt },
    { key: 'last_shift_on', label: 'Last shift', format: isoDate },
  ]));
}

// ---------------------------------------------------------------- quality indicators

function quarterWindow(flags) {
  if (flags.days) { const d = Number(flags.days); return { from: addDays(today(), -d), to: today(), label: `last ${d} days` }; }
  const t = new Date(`${today()}T00:00:00`);
  let q = Math.floor(t.getMonth() / 3);
  let y = t.getFullYear();
  if (str(flags.quarter || 'previous') === 'previous') { q -= 1; if (q < 0) { q = 3; y -= 1; } }
  const from = isoDate(new Date(y, q * 3, 1));
  const to = isoDate(new Date(y, q * 3 + 3, 1));
  const due = isoDate(new Date(y, q * 3 + 3, 21));
  return { from, to, due, label: `quarter ${from} to ${addDays(to, -1)}` };
}

async function qiRows(win, homeCode = null) {
  const params = [win.from, win.to];
  const homeFilter = homeCode ? `and h.code = $3` : '';
  if (homeCode) params.push(homeCode);
  const present = `r.admitted_on < $2::date and (r.left_on is null or r.left_on >= $1::date) and r.status <> 'respite'`;
  const rows = await db.query(`
    select h.code as home, h.jurisdiction,
      count(*) filter (where ${present}) as residents,
      count(*) filter (where ${present} and exists (select 1 from wounds w where w.resident_id = r.id and w.kind = 'pressure-injury' and w.acquired_here and w.found_on < $2::date and (w.healed_on is null or w.healed_on >= $1::date))) as pressure_injuries,
      count(*) filter (where ${present} and exists (select 1 from restrictive_practices p where p.resident_id = r.id and p.kind <> 'chemical' and p.started_on < $2::date and (p.ended_on is null or p.ended_on >= $1::date))) as restrictive_practices,
      count(*) filter (where ${present} and exists (select 1 from incidents i where i.resident_id = r.id and i.kind = 'fall' and i.occurred_at >= $1::date and i.occurred_at < $2::date)) as falls,
      count(*) filter (where ${present} and exists (select 1 from incidents i where i.resident_id = r.id and i.kind = 'fall' and i.injury = 'needs-treatment' and i.occurred_at >= $1::date and i.occurred_at < $2::date)) as falls_major_injury,
      count(*) filter (where ${present} and r.regular_medicines >= 9) as polypharmacy,
      count(*) filter (where ${present} and r.antipsychotic) as antipsychotic,
      count(*) filter (where ${present} and exists (select 1 from hospital_transfers t where t.resident_id = r.id and t.left_on >= $1::date and t.left_on < $2::date)) as hospitalised,
      (select count(*) from staff s where s.home_id = h.id and s.left_on >= $1::date and s.left_on < $2::date) as staff_left,
      (select count(*) from staff s where s.home_id = h.id and coalesce(s.started_on, '1900-01-01') < $1::date and (s.left_on is null or s.left_on >= $1::date)) as staff_at_start
    from homes h left join residents r on r.home_id = h.id
    where true ${homeFilter}
    group by h.id, h.code, h.jurisdiction order by h.code`, params);
  // Unplanned weight loss: first and last weight in the window (or the 30 days before it), 5% or more.
  const ws = await db.query(`select r.code, h.code as home, w.weighed_on, w.kg, w.planned_loss from weights w join residents r on r.id = w.resident_id join homes h on h.id = r.home_id
    where w.weighed_on >= $1::date - 30 and w.weighed_on < $2::date order by r.code, w.weighed_on`, [win.from, win.to]);
  const byRes = {};
  for (const w of ws) (byRes[w.code] ||= { home: w.home, kg: [], planned: false }).kg.push(n(w.kg)), w.planned_loss && (byRes[w.code].planned = true);
  const loss = {};
  for (const v of Object.values(byRes)) {
    const k = v.kg;
    const x = (loss[v.home] ||= { significant: 0, consecutive: 0 });
    if (k.length >= 2 && !v.planned && (k[k.length - 1] - k[0]) / k[0] * 100 <= -WEIGHT_LOSS_PCT) x.significant++;
    if (k.length >= 4 && !v.planned && k.slice(-4).every((q, i, a) => i === 0 || q < a[i - 1])) x.consecutive++;
  }
  return rows.map((r) => {
    const res = n(r.residents) || 0;
    const pct = (c) => (res ? r1((n(c) / res) * 100) : 0);
    const l = loss[r.home] || { significant: 0, consecutive: 0 };
    return { home: r.home, where: r.jurisdiction, residents: res,
      indicators: [
        { indicator: 'Pressure injuries (acquired here)', count: n(r.pressure_injuries), pct: pct(r.pressure_injuries) },
        { indicator: 'Restrictive practices, excluding chemical', count: n(r.restrictive_practices), pct: pct(r.restrictive_practices) },
        { indicator: 'Significant unplanned weight loss (5%+)', count: l.significant, pct: pct(l.significant) },
        { indicator: 'Consecutive unplanned weight loss', count: l.consecutive, pct: pct(l.consecutive) },
        { indicator: 'Falls', count: n(r.falls), pct: pct(r.falls) },
        { indicator: 'Falls with major injury', count: n(r.falls_major_injury), pct: pct(r.falls_major_injury) },
        { indicator: 'Polypharmacy (9+ regular medicines)', count: n(r.polypharmacy), pct: pct(r.polypharmacy) },
        { indicator: 'Antipsychotic use', count: n(r.antipsychotic), pct: pct(r.antipsychotic) },
        { indicator: 'Hospitalisation (ED or admitted)', count: n(r.hospitalised), pct: pct(r.hospitalised) },
        { indicator: 'Staff who left', count: n(r.staff_left), pct: n(r.staff_at_start) ? r1((n(r.staff_left) / n(r.staff_at_start)) * 100) : 0 },
      ] };
  });
}

async function qi(flags) {
  const win = quarterWindow(flags);
  const homeCode = flags.home ? (await findHome(flags.home)).code : null;
  const rows = await qiRows(win, homeCode);
  const subs = win.due ? await db.query(`select h.code as home, s.submitted_on from qi_submissions s join homes h on h.id = s.home_id where s.quarter_start = $1`, [win.from]) : [];
  for (const r of rows) {
    const s = subs.find((x) => x.home === r.home);
    r.submission = !isAU(r.where) || !win.due ? null : { due_on: win.due, submitted_on: s ? isoDate(s.submitted_on) : null, late: !s && today() > win.due };
  }
  out({ window: win, homes: rows }, (d) => [
    heading(`Quality indicators, ${win.label}`),
    ...d.homes.map((h) => `\n${h.home} (${h.where}), ${h.residents} residents${h.submission ? `. Due ${h.submission.due_on}: ${h.submission.submitted_on ? 'submitted ' + h.submission.submitted_on : h.submission.late ? 'NOT SUBMITTED, past due' : 'not submitted yet'}` : ''}\n` +
      table(h.indicators, [{ key: 'indicator', label: 'Indicator' }, { key: 'count', label: 'Residents', align: 'right' }, { key: 'pct', label: '%', align: 'right' }])),
    '\n  Counted from the records. Activities of daily living, incontinence care, consumer experience and quality of life come from the assessment tools and surveys the home runs; enter those in the portal from the tool.',
  ].join('\n'));
}

async function qiSubmit(args, flags) {
  const h = await findHome(args[0]);
  if (!isAU(h.jurisdiction)) throw new CliError('The quality indicator programme is Australian.');
  const win = quarterWindow({ quarter: flags.quarter || 'previous' });
  const on = parseDate(flags.date) || today();
  await db.query(`insert into qi_submissions (home_id, quarter_start, submitted_on, submitted_by) values ($1,$2,$3,$4) on conflict (home_id, quarter_start) do update set submitted_on = excluded.submitted_on`, [h.id, win.from, on, str(flags.by) || null]);
  out({ home: h.code, quarter_start: win.from, submitted_on: on, due_on: win.due, late: on > win.due }, (d) => `  QI data for ${d.home}, quarter from ${d.quarter_start}, submitted ${d.submitted_on}${d.late ? ' (after the due date)' : ''}.`);
}

// ---------------------------------------------------------------- monthly care statement

async function statement(args, flags) {
  const r = await findResident(args[0], { any: true });
  let month = str(flags.month);
  if (!month) { const t = new Date(`${today()}T00:00:00`); month = isoDate(new Date(t.getFullYear(), t.getMonth() - 1, 1)).slice(0, 7); }
  if (!/^\d{4}-\d{2}$/.test(month)) throw new CliError('--month=YYYY-MM');
  const from = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const to = isoDate(new Date(y, m, 1));
  const q = (sql) => db.query(sql, [r.id, from, to]);
  const [acts, meds, appts, ws, inc, wnd] = await Promise.all([
    q(`select done_on, domain, activity from activities where resident_id = $1 and done_on >= $2 and done_on < $3 order by done_on`),
    q(`select changed_on, medicine, change, detail from medication_changes where resident_id = $1 and changed_on >= $2 and changed_on < $3 order by changed_on`),
    q(`select seen_on, with_whom, reason, offsite from appointments where resident_id = $1 and seen_on >= $2 and seen_on < $3 order by seen_on`),
    db.query(`select weighed_on, kg from weights where resident_id = $1 and weighed_on < $2 order by weighed_on desc limit 2`, [r.id, to]),
    q(`select occurred_at, kind, injury, description from incidents where resident_id = $1 and occurred_at >= $2 and occurred_at < $3 and kind in ('fall', 'skin') order by occurred_at`),
    q(`select kind, stage, site, found_on, healed_on from wounds where resident_id = $1 and found_on < $3 and (healed_on is null or healed_on >= $2)`),
  ]);
  const latest = ws[0];
  const prior = ws[1];
  const weight = latest ? { weighed_on: isoDate(latest.weighed_on), kg: n(latest.kg), change_kg: prior ? r1(n(latest.kg) - n(prior.kg)) : null, change_pct: prior ? r1(((n(latest.kg) - n(prior.kg)) / n(prior.kg)) * 100) : null } : null;
  // The template suggests an identifier without full details: initials and birth year (JS45).
  const id = `${r.first_name[0]}${r.last_name[0]}${r.born_on ? String(isoDate(r.born_on)).slice(2, 4) : ''}`;
  const data = { resident: r.code, statement_id: id, name: nameOf(r), home: r.home, month, to_representative: r.statement_to_representative ? r.representative : null,
    wellbeing: acts, medication_changes: meds, appointments: appts, weight, falls_and_skin: inc, wounds: wnd };
  out(data, (d) => [
    heading(`Monthly care statement ${d.month}: ${d.name} (${d.statement_id}), ${d.home}`),
    `  Copy to ${d.to_representative || 'the resident only (no consent recorded for a copy to the representative)'}`,
    '\nWellbeing activities', table(d.wellbeing, [{ key: 'done_on', label: 'Date', format: isoDate }, { key: 'domain', label: 'Domain' }, { key: 'activity', label: 'Activity' }]),
    '\nMedication changes', table(d.medication_changes, [{ key: 'changed_on', label: 'Date', format: isoDate }, { key: 'medicine', label: 'Medicine' }, { key: 'change', label: 'Change' }, { key: 'detail', label: 'Detail' }]),
    '\nAppointments', table(d.appointments, [{ key: 'seen_on', label: 'Date', format: isoDate }, { key: 'with_whom', label: 'With' }, { key: 'reason', label: 'Reason' }]),
    `\nWeight: ${d.weight ? `${d.weight.kg}kg on ${d.weight.weighed_on}${d.weight.change_kg !== null ? `, ${d.weight.change_kg >= 0 ? '+' : ''}${d.weight.change_kg}kg (${d.weight.change_pct}%) since the weight before` : ''}` : 'not weighed'}`,
    '\nFalls and skin', table(d.falls_and_skin, [{ key: 'occurred_at', label: 'When', format: dateTime }, { key: 'kind', label: 'Kind' }, { key: 'description', label: 'What happened', width: 70 }]),
    '\nWounds', table(d.wounds, [{ key: 'kind', label: 'Kind' }, { key: 'stage', label: 'Stage' }, { key: 'site', label: 'Site' }, { key: 'healed_on', label: 'Healed', format: isoDate }]),
  ].join('\n'));
}

// ---------------------------------------------------------------- compliance

const RULES = [
  { id: 'R1', rule: 'SIRS Priority 1 reported within 24 hours of becoming aware', source: 'Aged Care Quality and Safety Commission, Serious Incident Response Scheme' },
  { id: 'R2', rule: 'SIRS Priority 2 reported within 30 days of becoming aware', source: 'Aged Care Quality and Safety Commission, Serious Incident Response Scheme' },
  { id: 'R3', rule: 'Restrictive practice has informed consent recorded', source: 'Aged Care Quality and Safety Commission, restrictive practices' },
  { id: 'R4', rule: 'Restrictive practice has a behaviour support plan and a review not overdue', source: 'Aged Care Quality and Safety Commission, behaviour support and restrictive practices' },
  { id: 'R5', rule: 'A registered nurse on site and on duty 24 hours a day (last 14 days)', source: '24/7 registered nurse responsibility, Aged Care Quality and Safety Commission' },
  { id: 'R6', rule: 'Direct care minutes at or above the home\'s target (last 28 days)', source: 'Department of Health, Disability and Ageing, care minutes; Quality Standards Outcome 2.8' },
  { id: 'R7', rule: 'Registered nurse minutes at or above the home\'s target (last 28 days)', source: 'Department of Health, Disability and Ageing, care minutes' },
  { id: 'R8', rule: 'No nurse rostered with an expired registration', source: 'Ahpra and the Nursing and Midwifery Board of Australia; Nursing Council of New Zealand practising certificates' },
  { id: 'R9', rule: 'No staff member with an expired police check or worker screening clearance', source: 'Aged Care Act 2024 and Aged Care Rules 2025, worker screening (police certificate or NDIS worker screening clearance)' },
  { id: 'R10', rule: 'Quality indicator data submitted by the 21st day after the quarter', source: 'National Aged Care Mandatory Quality Indicator Program' },
  { id: 'R11', rule: `Open disclosure recorded within ${OPEN_DISCLOSURE_DAYS} days of an incident with harm or a reportable incident`, source: 'Strengthened Aged Care Quality Standards, incident management and open disclosure' },
  { id: 'R12', rule: 'New Zealand: first interRAI within 21 days of admission', source: 'Age Related Residential Care Services Agreement, clause D16.2' },
  { id: 'R13', rule: 'New Zealand: interRAI reassessed at least six-monthly', source: 'Age Related Residential Care Services Agreement, clause D16' },
  { id: 'R14', rule: 'New Zealand: long-term care plan within 21 days of admission', source: 'Age Related Residential Care Services Agreement, clause D16' },
  { id: 'R15', rule: 'New Zealand: Section 31 notification made to HealthCERT', source: 'Health and Disability Services (Safety) Act 2001, section 31' },
];

async function runChecks() {
  const sirsList = await sirsRows();
  const minutes = await careMinutesRows(CARE_MINUTES_DAYS);
  const gaps = await rnCoverRows(RN_COVER_DAYS);
  const win = quarterWindow({ quarter: 'previous' });
  const found = {
    R1: sirsList.filter((s) => s.scheme === 'SIRS Priority 1' && s.flag === 'PAST DUE').map((s) => `${s.reference} ${s.home} ${s.resident || ''}: ${-s.hours_left} hours past due`),
    R2: sirsList.filter((s) => s.scheme === 'SIRS Priority 2' && s.flag === 'PAST DUE').map((s) => `${s.reference} ${s.home} ${s.resident || ''}: ${Math.round(-s.hours_left / 24)} days past due`),
    R3: (await db.query(`select resident, kind, description from restrictive_status where jurisdiction <> 'NZ' and no_consent order by resident`)).map((r) => `${r.resident} ${r.kind}: ${truncate(r.description, 50)}`),
    R4: (await db.query(`select resident, kind, no_plan, review_due_on from restrictive_status where jurisdiction <> 'NZ' and (no_plan or review_overdue) order by resident`)).map((r) => `${r.resident} ${r.kind}: ${r.no_plan ? 'no behaviour support plan' : `review overdue since ${isoDate(r.review_due_on)}`}`),
    R5: gaps.map((g) => `${g.home} ${g.day} ${g.from} to ${g.to} (${g.minutes} minutes)`),
    R6: minutes.filter((m) => m.total_met === false).map((m) => `${m.home}: ${m.total_per_resident} against ${m.care_minutes_target} (about ${m.total_short_minutes_per_day} minutes a day short)`),
    R7: minutes.filter((m) => m.rn_met === false).map((m) => `${m.home}: ${m.rn_per_resident} against ${m.rn_minutes_target}`),
    R8: (await db.query(`select code, full_name, home, registration_expires_on, last_shift_on from staff_checks where role in ('RN', 'EN') and registration_expires_on < current_date and last_shift_on >= current_date - ${RN_COVER_DAYS}`)).map((s) => `${s.code} ${s.full_name} (${s.home}): expired ${isoDate(s.registration_expires_on)}, last shift ${isoDate(s.last_shift_on)}`),
    R9: (await db.query(`select code, full_name, home, screening_expires_on from staff_checks where screening_expires_on < current_date`)).map((s) => `${s.code} ${s.full_name} (${s.home}): expired ${isoDate(s.screening_expires_on)}`),
    R10: today() > win.due ? (await db.query(`select h.code from homes h where h.jurisdiction <> 'NZ' and not exists (select 1 from qi_submissions s where s.home_id = h.id and s.quarter_start = $1) order by h.code`, [win.from])).map((h) => `${h.code}: quarter from ${win.from} was due ${win.due}`) : [],
    R11: (await db.query(`select reference, home, resident, occurred_at from incident_clock where open_disclosure_on is null and (injury <> 'none' or sirs_type is not null or s31_required) and occurred_at < now() - interval '${OPEN_DISCLOSURE_DAYS} days' order by occurred_at`)).map((i) => `${i.reference} ${i.home} ${i.resident || ''}: ${daysBetween(i.occurred_at, today())} days, no open disclosure recorded`),
    R12: (await db.query(`select s.code, s.name, s.admitted_on from resident_status s where s.jurisdiction = 'NZ' and s.status <> 'respite' and s.admitted_on < current_date - ${NZ_FIRST_DAYS}
      and not exists (select 1 from assessments a where a.resident_id = s.resident_id and a.kind = 'interrai' and a.done_on >= s.admitted_on)`)).map((r) => `${r.code} ${r.name}: admitted ${isoDate(r.admitted_on)}, no interRAI`),
    R13: (await db.query(`select code, name, last_interrai_on from resident_status where jurisdiction = 'NZ' and last_interrai_on < current_date - ${INTERRAI_CYCLE_DAYS} order by code`)).map((r) => `${r.code} ${r.name}: last interRAI ${isoDate(r.last_interrai_on)}`),
    R14: (await db.query(`select code, name, admitted_on from resident_status where jurisdiction = 'NZ' and status <> 'respite' and admitted_on < current_date - ${NZ_FIRST_DAYS} and last_care_plan_on is null order by code`)).map((r) => `${r.code} ${r.name}: admitted ${isoDate(r.admitted_on)}, no long-term care plan`),
    R15: sirsList.filter((s) => s.scheme.startsWith('Section 31') && s.flag === 'PAST DUE').map((s) => `${s.reference} ${s.home} ${s.resident || ''}: aware ${dateTime(s.aware_at)}, not notified`),
  };
  return RULES.map((r) => ({ ...r, count: found[r.id].length, findings: found[r.id] }));
}

async function compliance() {
  const rows = await runChecks();
  out(rows, () => heading('Compliance check') + '\n' + table(rows, [
    { key: 'id', label: 'Rule' }, { key: 'rule', label: 'What the records must show', width: 66 }, { key: 'count', label: 'Found', align: 'right' },
    { key: 'findings', label: 'Worst example', width: 64, format: (v) => v[0] || '' },
  ]) + '\n\n  Sources and the exact rule text: docs/compliance.md. A records check, not legal advice.');
}

async function attention() {
  const items = [];
  const add = (area, what, action) => items.push({ area, what, action });
  for (const c of await runChecks()) for (const f of c.findings) add('Compliance', `${c.id} ${f}`, c.rule);
  for (const s of await sirsRows()) if (s.flag === 'to report') add('Reporting', `${s.reference} ${s.scheme} at ${s.home}: ${s.hours_left} hours left`, 'Draft the notice and lodge it');
  for (const a of await db.query(`with latest as (select distinct on (resident_id, kind) resident_id, kind, next_due_on from assessments order by resident_id, kind, done_on desc)
      select s.code, s.home, l.kind, l.next_due_on from latest l join resident_status s on s.resident_id = l.resident_id where l.next_due_on <= current_date + ${DUE_SOON_DAYS} order by l.next_due_on`))
    add('Assessments', `${a.code} ${a.home} ${a.kind} due ${isoDate(a.next_due_on)}`, daysBetween(today(), a.next_due_on) < 0 ? 'Overdue: book it this week' : 'Book it');
  for (const c of await db.query(`select code, home, care_plan_due_on from resident_status where care_plan_due_on <= current_date + ${DUE_SOON_DAYS} order by care_plan_due_on`))
    add('Care plans', `${c.code} ${c.home} review due ${isoDate(c.care_plan_due_on)}`, daysBetween(today(), c.care_plan_due_on) < 0 ? 'Overdue: review and offer a case conference' : 'Schedule the review');
  for (const w of (await weightRows(WEIGHT_LOSS_PCT)).filter((x) => x.significant || x.consecutive_loss)) add('Clinical', `${w.code} ${w.name} ${w.change_pct}% in three months${w.consecutive_loss ? ', lower every month' : ''}`, 'GP and dietitian review, weigh weekly');
  for (const f of (await db.query(`select r.code, h.code as home, count(*) as falls from incidents i join residents r on r.id = i.resident_id join homes h on h.id = i.home_id where i.kind = 'fall' and i.occurred_at >= now() - interval '${FALLS_WINDOW_DAYS} days' group by r.code, h.code having count(*) >= ${REPEAT_FALLS}`)))
    add('Clinical', `${f.code} ${f.home} ${f.falls} falls in ${FALLS_WINDOW_DAYS} days`, 'Falls review: medication, physio, sensor placement');
  for (const w of await db.query(`select resident, home, kind, stage, site from wound_status where dressing_overdue`)) add('Clinical', `${w.resident} ${w.home} ${w.kind}${w.stage ? ' stage ' + w.stage : ''} ${w.site}: dressing overdue`, 'Dress it today and set the next date');
  for (const p of await db.query(`select resident, home, kind, review_due_on from restrictive_status where review_due_on between current_date and current_date + ${DUE_SOON_DAYS}`)) add('Restrictive practices', `${p.resident} ${p.home} ${p.kind} review due ${isoDate(p.review_due_on)}`, 'Review with the GP and the representative');
  for (const h of await db.query(`select r.code, h.code as home, t.left_on, t.reason from hospital_transfers t join residents r on r.id = t.resident_id join homes h on h.id = r.home_id where t.returned_on is null`))
    add('Hospital', `${h.code} ${h.home} in hospital since ${isoDate(h.left_on)} (${h.reason})`, 'Call the ward; plan the return');
  for (const s of await db.query(`select code, full_name, home, registration_days_left, screening_days_left from staff_checks where (registration_days_left between 0 and ${CHECK_WARN_DAYS}) or (screening_days_left between 0 and ${CHECK_WARN_DAYS})`))
    add('Workforce', `${s.code} ${s.full_name} (${s.home}): ${s.registration_days_left !== null && n(s.registration_days_left) <= CHECK_WARN_DAYS ? `registration in ${s.registration_days_left} days` : `police check in ${s.screening_days_left} days`}`, 'Remind them now');
  const win = quarterWindow({ quarter: 'previous' });
  if (today() <= win.due) for (const h of await db.query(`select h.code from homes h where h.jurisdiction <> 'NZ' and not exists (select 1 from qi_submissions s where s.home_id = h.id and s.quarter_start = $1)`, [win.from]))
    add('Quality indicators', `${h.code} QI data for the quarter from ${win.from} due ${win.due}`, 'Run qi and submit in the portal');
  out(items, () => heading('Needs attention') + '\n' + table(items, [{ key: 'area', label: 'Area' }, { key: 'what', label: 'What', width: 80 }, { key: 'action', label: 'Action', width: 60 }]));
}

// ---------------------------------------------------------------- import and export

async function importCmd(args, flags) {
  const [source, kind, file] = args;
  if (source !== 'leecare' || !['residents', 'incidents', 'weights'].includes(kind) || !file)
    throw new CliError('ac import leecare <residents|incidents|weights> <file.csv> --home=CODE [--dry-run]');
  const h = await findHome(flags.home);
  const rows = parseCsv(readFileSync(path.resolve(process.cwd(), file), 'utf8'));
  const dry = !!flags['dry-run'];
  const skipped = [];
  let saved = 0;
  const resByAny = async (raw) => {
    const s = str(raw).trim();
    if (!s) return null;
    const hit = await db.query(`select id, code from residents where home_id = $1 and (lower(code) = lower($2) or lower(first_name || ' ' || last_name) = lower($2) or lower(last_name || ', ' || first_name) = lower($2))`, [h.id, s]);
    return hit.length === 1 ? hit[0] : null;
  };
  if (!dry) await db.exec('BEGIN');
  try {
    if (kind === 'residents') {
      const prefix = h.code[0];
      let [{ next }] = await db.query(`select coalesce(max(substring(code from 2)::int), 0) + 1 as next from residents where code ~ ('^' || $1 || '[0-9]+$')`, [prefix]);
      for (const [i, r] of rows.entries()) {
        let first = pick(r, 'First Name', 'Given Name', 'Preferred Name');
        let last = pick(r, 'Surname', 'Last Name', 'Family Name');
        const full = pick(r, 'Resident', 'Resident Name', 'Name');
        if ((!first || !last) && full) {
          if (full.includes(',')) { [last, first] = full.split(',').map((x) => x.trim()); } else { first = full.split(' ')[0]; last = full.split(' ').slice(1).join(' '); }
        }
        const admitted = parseDate(pick(r, 'Admission Date', 'Admitted', 'Date of Admission', 'Entry Date'));
        if (!first || !last || !admitted) { skipped.push(`row ${i + 2}: ${full || first || '(no name)'}`); continue; }
        const existing = await db.query(`select id from residents where home_id = $1 and lower(first_name) = lower($2) and lower(last_name) = lower($3) and admitted_on = $4`, [h.id, first, last, admitted]);
        const status = /respite/i.test(pick(r, 'Status', 'Care Type', 'Stay Type')) ? 'respite' : 'permanent';
        const values = [parseDate(pick(r, 'Date of Birth', 'DOB', 'Birth Date'), 'birth date'), pick(r, 'Room', 'Room No', 'Bed') || null, status,
          pick(r, 'AN-ACC Class', 'AN-ACC', 'Funding Class', 'Level of Care', 'Care Level') || null, pick(r, 'GP', 'Doctor', 'General Practitioner') || null,
          pick(r, 'Representative', 'Next of Kin', 'NOK', 'Primary Contact') || null, pick(r, 'Representative Email', 'NOK Email', 'Contact Email') || null];
        if (!dry) {
          if (existing.length) await db.query(`update residents set born_on = coalesce($2::date, born_on), room = coalesce($3, room), status = case when status in ('permanent', 'respite') then $4 else status end, care_level = coalesce($5, care_level), gp = coalesce($6, gp), representative = coalesce($7, representative), representative_email = coalesce($8, representative_email) where id = $1`, [existing[0].id, ...values]);
          else {
            await db.query(`insert into residents (home_id, code, first_name, last_name, admitted_on, born_on, room, status, care_level, gp, representative, representative_email) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
              [h.id, `${prefix}${String(next).padStart(2, '0')}`, first, last, admitted, ...values]);
            next++;
          }
        }
        saved++;
      }
    } else if (kind === 'weights') {
      for (const [i, r] of rows.entries()) {
        const res = await resByAny(pick(r, 'Resident', 'Resident Name', 'Name', 'Resident ID'));
        const on = parseDate(pick(r, 'Date', 'Weigh Date', 'Recorded', 'Observation Date'));
        const kg = Number(String(pick(r, 'Weight', 'Weight (kg)', 'Kg', 'Value')).replace(/[^0-9.]/g, ''));
        if (!res || !on || !kg) { skipped.push(`row ${i + 2}: ${pick(r, 'Resident', 'Resident Name', 'Name') || '(no resident)'}`); continue; }
        if (!dry) await db.query(`insert into weights (resident_id, weighed_on, kg) values ($1,$2,$3) on conflict (resident_id, weighed_on) do update set kg = excluded.kg`, [res.id, on, kg]);
        saved++;
      }
    } else {
      for (const [i, r] of rows.entries()) {
        const ref = pick(r, 'Incident Number', 'Incident No', 'Reference', 'ID');
        const occurred = parseTime(pick(r, 'Incident Date', 'Date of Incident', 'Occurred', 'Date'));
        const description = pick(r, 'Description', 'Details', 'Summary', 'What Happened');
        if (!ref || !occurred || !description) { skipped.push(`row ${i + 2}: ${ref || '(no reference)'}`); continue; }
        const res = await resByAny(pick(r, 'Resident', 'Resident Name', 'Name'));
        const rawType = pick(r, 'Incident Type', 'Type', 'Category').toLowerCase();
        const kind = /fall/.test(rawType) ? 'fall' : /behav|aggress/.test(rawType) ? 'behaviour' : /medic/.test(rawType) ? 'medication' : /skin|wound|pressure/.test(rawType) ? 'skin' : /abscon|missing|absence/.test(rawType) ? 'absence' : /death/.test(rawType) ? 'death' : /complain/.test(rawType) ? 'complaint' : 'other';
        const injuryRaw = pick(r, 'Injury', 'Harm', 'Outcome').toLowerCase();
        const injury = /treat|fractur|hospital|sutur|major|serious/.test(injuryRaw) ? 'needs-treatment' : /minor|bruise|skin tear|graze/.test(injuryRaw) ? 'minor' : 'none';
        const prio = pick(r, 'SIRS Priority', 'Priority').replace(/[^12]/g, '');
        const sirsType = !prio ? null : /resident to resident|aggress|force|assault|physical/.test(rawType) ? 'unreasonable-force' : /verbal|psycholog|emotional/.test(rawType) ? 'psychological-abuse'
          : /sexual/.test(rawType) ? 'unlawful-sexual-contact' : /missing|abscon|absence/.test(rawType) ? 'unexplained-absence' : /death/.test(rawType) ? 'unexpected-death'
          : /neglect/.test(rawType) ? 'neglect' : /restrain|restrictive/.test(rawType) ? 'restrictive-practice' : /theft|steal|financ/.test(rawType) ? 'stealing-or-financial-coercion' : null;
        const reported = parseTime(pick(r, 'SIRS Reported', 'Date Reported', 'Reported Date'), 'report date');
        if (!dry) await db.query(`insert into incidents (home_id, resident_id, reference, occurred_at, aware_at, kind, injury, sirs_priority, reported_at, report_reference, description, closed_on, sirs_type)
            values ($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10,$11,$12) on conflict (reference) do update set description = excluded.description, reported_at = coalesce(incidents.reported_at, excluded.reported_at)`,
        [h.id, res?.id || null, ref, occurred, kind, injury, prio ? Number(prio) : null, reported, pick(r, 'SIRS Reference', 'Report Reference') || null, description, parseDate(pick(r, 'Closed', 'Date Closed', 'Closed Date'), 'close date'), sirsType]);
        saved++;
      }
    }
    if (!dry) await db.exec('COMMIT');
  } catch (e) {
    if (!dry) await db.exec('ROLLBACK');
    throw e;
  }
  out({ kind, home: h.code, saved: dry ? 0 : saved, would_save: saved, skipped }, (d) => `  ${dry ? 'Dry run: would save' : 'Saved'} ${d.would_save} ${kind} row(s) to ${d.home}.${d.skipped.length ? `\n  Skipped (could not read):\n    ${d.skipped.join('\n    ')}` : ''}`);
}

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = v instanceof Date ? v.toISOString() : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function exportCmd(flags) {
  const dir = path.resolve(REPO_ROOT, str(flags.out) || 'exports');
  mkdirSync(dir, { recursive: true });
  const tables = ['homes', 'staff', 'residents', 'assessments', 'care_plan_reviews', 'progress_notes', 'weights', 'wounds', 'medication_changes', 'appointments', 'activities',
    'hospital_transfers', 'incidents', 'restrictive_practices', 'shifts', 'qi_submissions', 'notes'];
  const counts = {};
  for (const t of tables) {
    const rows = await db.query(`select * from ${t} order by created_at`);
    const cols = rows.length ? Object.keys(rows[0]) : [];
    writeFileSync(path.join(dir, `${t}.csv`), [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n');
    counts[t] = rows.length;
  }
  out({ dir, counts }, () => `  Exported ${tables.length} tables to ${path.relative(REPO_ROOT, dir) || dir}: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}`);
}

// ---------------------------------------------------------------- dispatch table

const HELP = `ac: the residential aged care CLI. Add --json to any read for machine output.

  Overview      stats | attention | compliance | homes | residents [--home] | resident <r> | staff [--home]
  Residents     admit <home> "First Last" [--room] [--level] [--date] [--respite] [--gp] [--rep] [--rep-email] [--born] [--statement-to-rep]
                discharge <r> [--reason=discharged|deceased] [--date] | hospital <r> [--kind=ed|admitted] [--reason] [--date] | returned <r> [--date]
                log <r> "note" [--kind] [--by]
  Assessments   assessments [--due=14] [--home] | assess <r> <kind> [--date] [--score] [--outcome] [--next] [--by]
                care-plans [--due=14] | review <r> [--date] [--conference] [--rep-attended] [--summary] [--next] [--by]
  Clinical      weights [--loss=5] [--all] | weigh <r> <kg> [--date] [--planned] | falls [--days=90]
                wounds [--home] | wound <r> <kind> "site" [--stage] [--date] [--dressing] [--external] | heal <r> "site" [--date]
  Incidents     incidents [--all] [--home] | sirs | incident <home> <kind> "what happened" [--resident] [--occurred] [--aware] [--injury] [--sirs=type] [--priority] [--s31] [--police]
                report <ref> [--at] [--ref] | disclose <ref> [--date] | close <ref> [--date] [--actions]
  Restrictive   restrictive [--home] | restrict <r> <kind> ["what and why"] [--started] [--consent-from] [--consent-on] [--prescriber] [--plan-on] [--review-due] | restrict-end <r> <kind> [--date]
  Workforce     care-minutes [--days=28] [--home] | rn-cover [--days=14] [--all] | checks [--days=60]
  Quality       qi [--quarter=previous|current] [--days=N] [--home] | qi-submit <home> [--quarter] [--date] [--by] | statement <r> [--month=YYYY-MM]
  Data          import leecare <residents|incidents|weights> <file.csv> --home [--dry-run] | export [--out=dir]`;

const COMMANDS = {
  stats: () => stats(), attention: () => attention(), compliance: () => compliance(), homes: () => homes(), residents: (a, f) => residents(f), resident: (a) => residentCard(a), staff: (a, f) => staffList(f),
  admit: (a, f) => admit(a, f), discharge: (a, f) => discharge(a, f), hospital: (a, f) => hospital(a, f), returned: (a, f) => returned(a, f), log: (a, f) => log(a, f),
  assessments: (a, f) => assessmentsDue(f), assess: (a, f) => assess(a, f), 'care-plans': (a, f) => carePlansDue(f), review: (a, f) => review(a, f),
  weights: (a, f) => weights(f), weigh: (a, f) => weigh(a, f), falls: (a, f) => falls(f), wounds: (a, f) => wounds(f), wound: (a, f) => wound(a, f), heal: (a, f) => heal(a, f),
  incidents: (a, f) => incidents(f), sirs: () => sirs(), incident: (a, f) => incidentNew(a, f), report: (a, f) => report(a, f), disclose: (a, f) => disclose(a, f), close: (a, f) => closeIncident(a, f),
  restrictive: (a, f) => restrictive(f), restrict: (a, f) => restrict(a, f), 'restrict-end': (a, f) => restrictEnd(a, f),
  'care-minutes': (a, f) => careMinutes(f), 'rn-cover': (a, f) => rnCover(f), checks: (a, f) => staffChecks(f),
  qi: (a, f) => qi(f), 'qi-submit': (a, f) => qiSubmit(a, f), statement: (a, f) => statement(a, f),
  import: (a, f) => importCmd(a, f), export: (a, f) => exportCmd(f),
};

const { args, flags } = parseArgv(process.argv.slice(2));
JSON_OUT = !!flags.json;
const cmd = args.shift();
if (!cmd || cmd === 'help' || flags.help || !COMMANDS[cmd]) {
  console.log(HELP);
  process.exit(cmd && cmd !== 'help' && !COMMANDS[cmd] ? 1 : 0);
}
db = await getDb();
try {
  await COMMANDS[cmd](args, flags);
} catch (e) {
  if (e instanceof CliError) { console.error(e.message); process.exitCode = e.code; }
  else { console.error(e.stack || e.message); process.exitCode = 2; }
} finally {
  await db.close();
}
