---
description: Record a care plan review or case conference, with who attended and when the next one is due.
---

Run `npm run ac -- review <resident> --summary="what changed" [--conference] [--rep-attended] [--by=<staff code>] [--date] [--next]`.

The next review defaults to 90 days in Australia (a house rule; change it in `scripts/ac.mjs`) and six months in New Zealand.
