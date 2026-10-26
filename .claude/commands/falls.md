---
description: Falls in the last 90 days by resident: how many, how many needed treatment, the times of day, and who is a repeat faller.
---

1. Run `npm run ac -- falls` (`--days=30` for a shorter window).
2. For each repeat faller, look at the times of day and the descriptions (`/resident`) and suggest the review: medication (sedatives, antihypertensives), physiotherapy, sensor mat placement, toileting at the times they fall.
3. Record each new fall with `/incident` (kind fall), never as a note alone.
