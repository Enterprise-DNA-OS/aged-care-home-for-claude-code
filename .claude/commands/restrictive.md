---
description: Restrictive practices in use, with what is missing: informed consent, a behaviour support plan, or a review that is overdue. Record, update or end one.
---

- In use: `npm run ac -- restrictive`.
- New: `npm run ac -- restrict <resident> <chemical|environmental|mechanical|physical|seclusion> "what and why" --started=YYYY-MM-DD --consent-from="name (relationship, authority)" --consent-on=YYYY-MM-DD --prescriber="Dr ..." --plan-on=YYYY-MM-DD --review-due=YYYY-MM-DD`.
- Update the one in use (consent, plan, review): the same command without the description.
- End: `npm run ac -- restrict-end <resident> <kind>`.

A chemical restraint is a medicine used to influence behaviour, not to treat a diagnosed condition. If the record does not say which it is, ask the operator to confirm with the prescriber. Never decide it here.
