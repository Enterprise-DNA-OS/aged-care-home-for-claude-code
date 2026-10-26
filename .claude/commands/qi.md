---
description: The quality indicators for last quarter (or this quarter, or the last N days) from the records, and whether each Australian home has submitted.
---

1. Run `npm run ac -- qi` for last quarter, `--quarter=current` for this one so far, or `--days=91` for a rolling three months.
2. Show each home's table and the submission line: due on the 21st day of the month after the quarter, no extensions.
3. The counts come from the records: pressure injuries, restrictive practices, weight loss, falls, medicines, hospital, staff who left. Activities of daily living, incontinence, consumer experience and quality of life come from the tools and surveys the home runs; remind the operator to enter those.
4. Once submitted in the portal: `npm run ac -- qi-submit <HOME> --by="name"`.
