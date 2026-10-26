# Aged Care Home for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS]
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| What needs doing today? What is overdue? | `/attention` |
| The weekly clinical and quality meeting | `/weekly-review` |
| How are we going, in short | `/stats` |
| Every home, occupancy, minutes against target | `/homes` |
| The resident list | `/residents` |
| One resident in full | `/resident` |
| A new resident or a respite stay | `/admit` |
| A resident leaves or dies | `/discharge` |
| To hospital, back from hospital | `/hospital` |
| Note something about a resident | `/log` |
| Which assessments are due | `/assessments` |
| An assessment has been done | `/assess` |
| Which care plans are due | `/care-plans` |
| A care plan review or case conference | `/review` |
| Weight loss; a new weight | `/weights` |
| Falls and repeat fallers | `/falls` |
| Wounds and pressure injuries | `/wounds` |
| Open incidents | `/incidents` |
| Something happened | `/incident` |
| What still needs reporting | `/sirs` |
| Write the SIRS or Section 31 notice | `/draft-sirs-notice` |
| Restraints, consent, behaviour support plans | `/restrictive` |
| Care minutes against target | `/care-minutes` |
| Was there an RN on every hour | `/rn-cover` |
| Registrations and police checks | `/staff-checks` |
| Quality indicators; submitted them | `/qi` |
| A monthly care statement | `/draft-care-statement` |
| A letter to a family | `/draft-family-update` |
| Set up a case conference | `/draft-case-conference` |
| Are we compliant | `/compliance` |
| Branded statements, incident reports, handover sheets | `/documents` |
| Printable dashboards; a new one | `/view`, `/new-view` |
| Bring in Leecare data | `/import` |
| Everything out to CSV | `/export` |
| Add something | `/add` |
| Change a field, rule or setting | `/customise` |

If an ask fits nothing here, run the CLI directly (`npm run ac -- help`) and then propose a new command for it.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never lodge a SIRS notification, a Section 31 notification or quality indicator data from here. Draft the facts; a person lodges them in the portal and tells you the reference.
- Never delete records without an explicit yes in this session. Prefer marking discharged, ended, healed or closed.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so. Never answer a question about a resident from memory.
- Never decide whether something is a reportable incident, a chemical restraint or a diagnosis. Show the rule and the record; a registered nurse or the prescriber decides.
- Resident health information stays in this database and in `drafts/`. Never paste it into anything outside this folder.
- Compliance answers cite the rule and its source from `docs/compliance.md`. They are records checks, not legal or clinical advice.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the thesis, the compliance rules with sources, and the guide for moving off Leecare.
- `documents.json` and `views.json` the paperwork and dashboards, each section one query.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/leecare
