---
description: Bring residents, weights and incidents across from Leecare report exports saved as CSV. Dry run first, then import.
---

1. The homes must exist first. Each file goes to one home: `--home=<CODE>`.
2. Dry run each file: `npm run ac -- import leecare residents <file.csv> --home=<CODE> --dry-run`, then `weights`, then `incidents`. Show the counts and anything it could not read.
3. On a yes, run each without `--dry-run`. Residents first: weights and incidents match residents by name. Running it twice is harmless.
4. Check the counts against the same Leecare reports: residents per home, incidents in the period.
5. Column names and what maps: `docs/replace-leecare.md`. If the operator's export has other columns, map them in `scripts/ac.mjs` (`importCmd`) and add the case to the smoke test.
