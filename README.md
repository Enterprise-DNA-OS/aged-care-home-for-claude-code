<h1 align="center">Aged Care Home for Claude Code</h1>

<p align="center">
  <strong>The open-source residential aged care system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Leecare data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=leecare">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/leecare?utm_source=github&utm_medium=readme&utm_campaign=leecare">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-leecare">Instead of Leecare</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Aged Care Home for Claude Code does the job you pay Leecare for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the Leecare dashboard cannot.

Leecare does not publish a price. Its Platinum6 suite is sold module by module (P6Exec, P6Med, P6Finance, P6Mobile, P6MyCarePlan, P6Community and more) and quoted on request ([leecare.com.au](https://leecare.com.au/)), and residential clinical systems in Australia are usually priced per bed per month, so the bill grows with every bed and every module you add.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=leecare).

It is for residential aged care providers in Australia and New Zealand running one to a dozen homes. It holds residents and their rooms, assessments (interRAI, falls, pressure, nutrition, pain, behaviour), care plan reviews and case conferences, progress notes, weights, wounds, incidents with their SIRS and Section 31 clocks, restrictive practices with consent and behaviour support plans, hospital transfers, and the roster for care minutes and registered nurse cover. Fifteen compliance checks cover SIRS deadlines, restrictive practice consent and review, 24/7 registered nurse cover, care minutes, registrations, police checks, quality indicator submissions, open disclosure, interRAI and Section 31, each with its source. It builds the quality indicators and the monthly care statement from the records. Medication charting stays in your electronic medication chart.

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no modules, no per-bed fee. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too (bedside charting and medication rounds).

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/aged-care-home-for-claude-code.git
cd aged-care-home-for-claude-code
npm install
npm run demo
```

`npm run demo` creates the database and loads Harbourlight Care (a made-up provider with three small homes in Penrith, Geelong and Christchurch: a Priority 1 SIRS incident 30 hours since the home became aware and not lodged, a Priority 2 incident 34 days old with no open disclosure, an antipsychotic used as a chemical restraint with no consent recorded, a lap belt whose review is overdue, a night with no registered nurse on site for seven and a half hours, a home under its care minutes target, a nurse rostered on an expired registration, a carer with an expired police check, a quality indicator submission missed, a resident down 6.4% in three months, a repeat faller, a pressure injury with its dressing overdue, and in New Zealand a new resident with no interRAI or care plan after 30 days, an interRAI seven months old and a stage 3 pressure injury with no Section 31 notification), then prints the homes, the reporting clocks and the compliance check.

Then open the folder in Claude Code and type:

```
/attention
```

Try `/sirs`, `/resident W05`, `/care-minutes`, `/qi`, `/draft-care-statement W03`. When you are ready for real data, delete `.data/` and start with `/import`.

Fill in the "Who this is for" block in [CLAUDE.md](CLAUDE.md), and put your business name, logo and colours in [brand.json](brand.json) so the care statements, incident reports and handover sheets carry them.

## Your first hour: ten things to ask for

1. "What needs attention today?"
2. "Colin pushed Frank in the lounge last night and Frank needed steri-strips. Record it and tell me when the SIRS report is due."
3. "Draft the SIRS notice for that one."
4. "Did we have a registered nurse on site every hour this fortnight?"
5. "Are we on track for care minutes at Banksia this quarter, and how many shifts short are we?"
6. "Who has lost 5% of their weight in three months?"
7. "George's daughter gave consent for the risperidone today. Record it."
8. "What will our quality indicators look like for last quarter?"
9. "Write Margaret Doyle's monthly care statement for her daughter."
10. "Bring in our resident list and incident register from Leecare."

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee. Resident health information belongs in a database you control, in the country you operate in.

## The commands

| Command | What it does |
|---|---|
| `/attention` | Everything that wants a decision, worst first: breaches, reporting clocks, assessments, care plans, clinical risks, workforce. |
| `/weekly-review` | The weekly clinical and quality meeting, written from three commands. |
| `/stats` | The group in five lines. |
| `/homes` | Every home: occupancy, care and RN minutes against target, incidents, restraints, wounds. |
| `/residents` | The resident list for a home or all. |
| `/resident` | One resident in full. |
| `/admit` | Admit a resident and show the clocks that start. |
| `/discharge` | A resident leaves or dies. |
| `/hospital` | To hospital and back. |
| `/log` | A progress note. |
| `/assessments` | Assessments overdue or due soon, including the first interRAI in New Zealand. |
| `/assess` | Record an assessment. |
| `/care-plans` | Care plan reviews overdue or due soon. |
| `/review` | Record a care plan review or case conference. |
| `/weights` | Unplanned weight loss; record a weight. |
| `/falls` | Falls by resident, times of day, repeat fallers. |
| `/wounds` | Open wounds and pressure injuries; record or heal one. |
| `/incidents` | Open incidents and their reporting status. |
| `/incident` | Record an incident, with the SIRS priority suggested and the deadline worked out. |
| `/sirs` | The reporting clocks, hours left on each. |
| `/draft-sirs-notice` | Draft the facts for a SIRS or Section 31 notification. |
| `/restrictive` | Restrictive practices in use and what is missing; record, update or end one. |
| `/care-minutes` | Care minutes and RN minutes per resident per day against each home's target. |
| `/rn-cover` | Every stretch with no registered nurse on the roster. |
| `/staff-checks` | Registrations and police checks expired or expiring. |
| `/qi` | The quality indicators from the records, and the submission status. |
| `/draft-care-statement` | A resident's monthly care statement. |
| `/draft-family-update` | An update to the representative after a change. |
| `/draft-case-conference` | The invitation and agenda for a case conference. |
| `/compliance` | Fifteen rules checked against the records, each with its source. |
| `/documents` | Monthly care statements, incident reports and handover sheets in your brand. |
| `/view` | This week, the workforce and the resident list as printable pages. |
| `/new-view` | Add a dashboard in plain language. |
| `/import` | Bring residents, weights and incidents across from Leecare. |
| `/export` | Every table to CSV. |
| `/add` | Add anything by asking; routes to the right command. |
| `/customise` | Change a field, a rule or a setting in plain language. |

Every command is a short recipe over one CLI: `npm run ac -- help` lists it all.

## Ten questions answered from your own records

Every one is a real command on the demo data today.

1. Which reportable incidents are still inside their clock, and which are already past it? (`sirs`)
2. Was there a registered nurse on site every hour of the last fortnight, home by home? (`rn-cover`)
3. Is each home on track for its care minutes and RN minutes targets, and how many minutes a day short? (`care-minutes`)
4. Who has lost 5% or more of their weight in three months, and who has been lower every month? (`weights`)
5. Which residents fall again and again, and at what time of night? (`falls`)
6. Which restrictive practices have no consent, no behaviour support plan or an overdue review? (`restrictive`)
7. What will the quality indicators show before we submit them? (`qi`)
8. Which nurses are rostered on an expired registration, and whose police check runs out next? (`checks`)
9. Which New Zealand residents are past 21 days with no interRAI or care plan, and whose six-monthly interRAI is late? (`assessments`, `compliance`)
10. What goes in this resident's monthly care statement: activities, medicine changes, appointments, weight? (`statement`)

## Instead of Leecare

Export the resident list, the weights and the incident register from Leecare to Excel and save each as CSV, then:

```
npm run ac -- import leecare residents residents.csv --home=WATTLE --dry-run
npm run ac -- import leecare residents residents.csv --home=WATTLE
npm run ac -- import leecare weights weights.csv --home=WATTLE
npm run ac -- import leecare incidents incidents.csv --home=WATTLE
```

Check the counts against the same Leecare reports before you switch. The full guide, what maps and what does not: [docs/replace-leecare.md](docs/replace-leecare.md). The rules the compliance check uses, with sources: [docs/compliance.md](docs/compliance.md).

## Architecture

```
aged-care-home-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/ac.mjs            the one CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     the thesis, the compliance rules and the Leecare guide
  documents.json, views.json  the paperwork and dashboards, as SQL
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Aged Care Home for Claude Code for your business, migrates your Leecare data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=leecare)
- Read more: [enterprisedna.co/omni/instead-of/leecare](https://enterprisedna.co/omni/instead-of/leecare?utm_source=github&utm_medium=readme&utm_campaign=leecare)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
