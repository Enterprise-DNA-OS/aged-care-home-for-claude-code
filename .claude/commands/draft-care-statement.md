---
description: Draft a resident's monthly care statement for last month: wellbeing activities, medication changes, appointments, weight and nutrition, falls, wounds.
---

1. Run `npm run ac -- statement <resident> --json` (`--month=YYYY-MM` for another month).
2. Write `drafts/care-statement-<code>-<month>.md` in plain English to the resident (or the representative when the statement says the resident consented to a copy). Short sections, the resident's identifier at the top (initials and birth year), no full clinical detail.
3. Weight: give the kilograms and the change as both kilograms and percent. If loss was planned, say why.
4. Leave out a section with nothing in it. Never invent an activity or an appointment.
5. `npm run docs -- monthly-care-statement` renders the same statement, branded, for every Australian resident.
