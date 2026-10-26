---
description: Open wounds and pressure injuries with their stage, days open and next dressing. Record a new wound or a healed one.
---

- Open wounds: `npm run ac -- wounds`.
- New: `npm run ac -- wound <resident> <pressure-injury|skin-tear|ulcer|surgical|other> "site" [--stage=1|2|3|4|unstageable|deep-tissue] [--dressing=YYYY-MM-DD] [--external]`. Use `--external` when the resident arrived with it.
- Healed: `npm run ac -- heal <resident> "site"`.

In New Zealand every pressure injury at stage 3 or worse (unstageable and deep tissue included, wherever it developed) needs a Section 31 notification: record it with `/incident --s31`.
