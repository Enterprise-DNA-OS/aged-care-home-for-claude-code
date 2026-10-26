---
description: The weekly clinical and quality meeting, written from three commands: the homes, the reporting clocks and the attention list.
---

Run these three and write the review from what they return. Nothing they do not support goes in.

```
npm run ac -- homes
npm run ac -- sirs
npm run ac -- attention
```

Then, no more than a page:

1. **The group in one line.** From `npm run ac -- stats`: residents and occupancy, open incidents, compliance findings.
2. **Each home.** Occupancy, care minutes and RN minutes against target, open incidents, restrictive practices, wounds.
3. **Incidents.** Anything reportable, whether it went in on time, and open disclosure.
4. **Clinical risk.** Weight loss (`npm run ac -- weights`), falls (`npm run ac -- falls`), wounds, hospital transfers.
5. **Workforce.** Hours with no RN (`npm run ac -- rn-cover`), registrations and police checks coming up.
6. **Five things to do this week**, from the attention list, with why each made it.
7. **One thing for the director of nursing to decide.**

`npm run view -- week` renders the same numbers as a printable page.
