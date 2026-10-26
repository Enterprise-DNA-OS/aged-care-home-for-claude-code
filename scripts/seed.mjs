#!/usr/bin/env node
// Loads supabase/seed.sql: Harbourlight Care, a made-up provider with three small homes in Penrith,
// Geelong and Christchurch. Dates are relative to today and every insert skips what is already
// there, so re-running it is harmless.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';

export async function seed(db) {
  await db.exec(readFileSync(path.join(REPO_ROOT, 'supabase', 'seed.sql'), 'utf8'));
  const [c] = await db.query(`
    select (select count(*) from homes) as homes, (select count(*) from residents where status in ('permanent', 'respite', 'in-hospital')) as residents,
           (select count(*) from staff) as staff, (select count(*) from incidents) as incidents,
           (select count(*) from assessments) as assessments, (select count(*) from shifts) as shifts`);
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Number(v)]));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const db = await getDb();
  try {
    const n = await seed(db);
    console.log(`seed: ${n.homes} homes, ${n.residents} residents, ${n.staff} staff, ${n.incidents} incidents, ${n.assessments} assessments, ${n.shifts} shifts`);
  } finally {
    await db.close();
  }
}
