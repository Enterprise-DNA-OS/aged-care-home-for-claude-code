---
description: Record an assessment that has been done, with its score, outcome and next due date.
---

Run `npm run ac -- assess <resident> <interrai|an-acc|falls-risk|pressure-risk|pain|nutrition|cognition|continence|behaviour> --score="..." --outcome="..." --by=<staff code> [--date] [--next]`.

The next due date defaults to six months for interRAI and 90 days for everything else. If the outcome changes the care needed (a higher falls risk, a new pressure risk), offer `/review` for the care plan.
