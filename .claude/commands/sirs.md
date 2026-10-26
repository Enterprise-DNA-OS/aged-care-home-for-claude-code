---
description: The reporting clocks: every SIRS and Section 31 incident not yet reported, with hours left, and the ones reported in the last 30 days.
---

1. Run `npm run ac -- sirs`.
2. PAST DUE first, in plain words: "INC-2026-0141 was due at 6.20am today and has not been lodged."
3. For each one still open, offer `/draft-sirs-notice`. Lodging happens in the regulator's portal, by a person.
4. Once lodged: `npm run ac -- report <ref> --ref=<the portal's reference> --at="YYYY-MM-DD HH:MM"`.
