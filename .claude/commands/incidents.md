---
description: Open incidents with their reporting status, or every incident (--all), for one home or all.
---

1. Run `npm run ac -- incidents` (`--all` for closed ones too, `--home=<CODE>` for one home).
2. Anything flagged REPORT LATE goes first. Then reportable ones still inside their clock (`/sirs`).
3. To close one: `npm run ac -- close <ref> --actions="what changed"`. A reportable incident cannot close until its report is recorded.
