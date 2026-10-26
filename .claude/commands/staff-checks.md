---
description: Nursing registrations and police checks that have expired or expire in the next 60 days, and whether that person has been rostered.
---

1. Run `npm run ac -- checks` (`--days=90` for a wider window).
2. EXPIRED and rostered recently goes first: that nurse should not be on the roster until it is renewed.
3. Offer to draft reminder messages to each person into `drafts/`. Never send them.
