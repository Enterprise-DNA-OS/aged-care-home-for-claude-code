---
description: Check the records against the fifteen rules in docs/compliance.md (SIRS clocks, restrictive practices, 24/7 RN, care minutes, registrations, police checks, quality indicators, open disclosure, interRAI, Section 31) and report what is breached, with the rule cited.
---

1. Run `npm run ac -- compliance` (and `--json` to see every finding, not just the worst).
2. Report as a table: rule, count, the worst example, the source from `docs/compliance.md`. Breached first, then clean.
3. For anything breached, give the fix the operator can approve: the notice to draft (`/draft-sirs-notice`), the record to update (consent, plan, review), the shift to cover, the person to stand down until their registration is renewed.
4. If a rule in `docs/compliance.md` is out of date, say so and stop. Do not guess at law. The operator confirms the rule, then you update the doc and the check together.

Nothing here is legal or clinical advice. It checks the records against the rules the operator has told the system to enforce, with sources.
