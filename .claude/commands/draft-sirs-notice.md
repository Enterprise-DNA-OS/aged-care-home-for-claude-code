---
description: Draft the facts for a SIRS notification (Australia) or a Section 31 notification (New Zealand) from the incident record, ready for a person to lodge in the portal.
---

1. Run `npm run ac -- incidents --all --json` and find the incident, then `npm run ac -- resident <code> --json` for the resident's details.
2. Write `drafts/notice-<reference>.md` with what the portal asks for, in plain facts: the provider and home, when it happened and when the home became aware, the type and priority, who was involved (resident codes, staff by role not name), what happened, the injury and treatment, who has been told (police, GP, family, with times), and what the home has done to keep the resident safe.
3. No opinion, no blame, no diagnosis the GP has not made. Mark anything not in the record as `[to confirm]`.
4. Never lodge it. Say: "Lodge this in the portal, then tell me the reference and I will record it."
