---
description: Admit a new resident (permanent or respite) and show the clocks that start on admission.
---

1. Collect: home, full name, room, care level (AN-ACC class or New Zealand level), GP, representative and their email, date of birth, admission date (default today), whether the resident consents to their monthly care statement going to the representative.
2. Run `npm run ac -- admit <HOME> "First Last" --room=<n> --level="..." --gp="..." --rep="..." --rep-email=... --born=YYYY-MM-DD [--respite] [--statement-to-rep]`.
3. Say what is due: in New Zealand the first interRAI and the long-term care plan within 21 days; in Australia the first care plan and the home's own admission assessments (falls, pressure, nutrition, pain, continence).
4. Offer to record the admission assessments as they are done (`/assess`).
