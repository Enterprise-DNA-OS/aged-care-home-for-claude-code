---
description: A resident goes to hospital (emergency department or admitted), or comes back.
---

- Going: `npm run ac -- hospital <resident> --kind=ed|admitted --reason="..." --date=YYYY-MM-DD`. An admission sets the resident to in hospital.
- Back: `npm run ac -- returned <resident> --date=YYYY-MM-DD`.
- On return, remind the operator to review the care plan and record any medication changes from the discharge summary.
