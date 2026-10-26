---
description: Record a resident leaving: discharged or deceased. Ends their restrictive practices.
---

1. Confirm the resident and the date with the operator; this changes their status.
2. Run `npm run ac -- discharge <resident> --reason=discharged|deceased --date=YYYY-MM-DD`.
3. If the death was unexpected, it is a Priority 1 SIRS incident in Australia: record it with `/incident` and draft the notice with `/draft-sirs-notice`.
