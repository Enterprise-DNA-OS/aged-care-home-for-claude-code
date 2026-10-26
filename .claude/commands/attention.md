---
description: Everything that wants a decision today, worst first: compliance breaches, reporting clocks, assessments and care plans due, weight loss, falls, wounds, hospital stays and expiring registrations.
---

1. Run `npm run ac -- attention`.
2. Read it in order:
   - **Compliance** first. Each line is a rule the records say has been broken. A Priority 1 SIRS incident past 24 hours, a night with no registered nurse, or a restraint with no consent is said plainly and today.
   - **Reporting.** SIRS and Section 31 clocks still running, with hours left.
   - **Assessments and care plans.** Overdue first, then due inside 14 days.
   - **Clinical.** Unplanned weight loss, repeat fallers, dressings overdue.
   - **Restrictive practices, hospital, workforce, quality indicators.**
3. For each item give the one action and who owns it (the home's manager from `npm run ac -- homes`, or the RN named on the record).
4. Anything that needs a notice or a letter is drafted to `drafts/`, never sent or lodged.

If the operator asks "what should I do today", pick the top three and say why those three.
