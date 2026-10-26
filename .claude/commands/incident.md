---
description: Record an incident: a fall, a behaviour, a medication error, a skin injury, a resident missing, a death, a complaint. Works out whether it is a SIRS or Section 31 notification and when it is due.
---

1. Collect: home, kind, what happened in plain words, the resident, when it happened, when the home became aware (the clock starts there), the injury (none, minor, needs treatment), and whether police were called.
2. Australia: decide if it is a SIRS reportable incident. The eight types are unreasonable use of force, unlawful sexual contact or inappropriate sexual conduct, psychological or emotional abuse, unexpected death, stealing or financial coercion by a staff member, neglect, inappropriate use of a restrictive practice, and unexplained absence from care. If unsure, say so and suggest the operator check the Commission's decision guide; never guess it out of the scheme.
3. Run `npm run ac -- incident <HOME> <fall|behaviour|medication|skin|absence|death|complaint|other> "what happened" --resident=<code> --occurred="YYYY-MM-DD HH:MM" --aware="YYYY-MM-DD HH:MM" --injury=none|minor|needs-treatment [--sirs=<type>] [--priority=1|2] [--police=now] [--s31]`. Leave out `--priority` and the CLI suggests one.
4. Tell the operator the deadline in hours. Offer `/draft-sirs-notice` straight away for a Priority 1.
5. Remind them about open disclosure to the resident or their representative (`npm run ac -- disclose <ref>` once done).
