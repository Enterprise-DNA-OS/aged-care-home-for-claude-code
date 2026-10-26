---
description: Every stretch of time in the last 14 days with no registered nurse on the roster at an Australian home.
---

1. Run `npm run ac -- rn-cover` (`--days=28` for longer, `--all` to include New Zealand homes).
2. For each gap, show the home, day and hours. Ask whether the roster is wrong (a shift worked but not entered) before treating it as a breach.
3. If it was real, note it on the home (`/log` or a note) with what cover there was.
