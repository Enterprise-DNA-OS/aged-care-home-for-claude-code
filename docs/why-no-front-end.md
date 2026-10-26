# Why there is no front end

Leecare is a database with a subscription. The records underneath are ordinary: residents, assessments, care plan reviews, notes, weights, wounds, incidents, restraints, shifts. What you pay for is the layer on top that lets people who do not write SQL get at them: screens, forms, filters, dashboards, each module licensed on its own.

That layer was the product because talking to a database was hard. It is not any more. Open this folder in Claude Code, ask "which incidents still need a SIRS report?" or "who has lost weight this quarter?", and it runs the query and explains the answer.

## What you gain

- **Answers the screens never had.** Which nights had no registered nurse. Which residents fall at the same time of night. What your quality indicators will look like before you submit.
- **The clocks in one place.** SIRS, Section 31, interRAI, care plans, consent reviews, registrations, quality indicators, all checked by one command against cited rules.
- **No modules and no seats.** Every manager and RN who needs to look can look.
- **Your records in your database.** Plain tables. Back them up, query them from anything, leave any time.

## What a screen still does better

Be honest about this before you switch:

- **Charting at the bedside.** Carers record care on a tablet as they go. Talking to Claude Code at a desk is not that. Enterprise DNA builds a simple charting screen for carers on top of the same database when a home wants one.
- **Medication rounds.** Keep your electronic medication chart. This system records the changes, not the administration.
- **Offline.** It runs where your database is reachable.
- **A help desk.** This is open source. Enterprise DNA supports the installed version for providers that want someone to call.

## Who this fits

Groups where the clinical managers and the director of nursing spend their week chasing reports, clocks and audits, and want the answers more than another screen. If your carers need a tablet screen all shift, keep that screen and put this behind it.

Installed and run for you: https://enterprisedna.co/omni/instead-of/leecare
