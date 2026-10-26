---
description: Render the paperwork in your brand: monthly care statements, incident reports and the clinical handover sheet for each home.
---

1. Run `npm run docs` for everything, or one type: `npm run docs -- monthly-care-statement`, `npm run docs -- incident-report`, `npm run docs -- handover-sheet`.
2. Files land in `docs-out/<type>/`. Open in a browser and print to PDF.
3. Business name, logo and colours come from `brand.json`. To change what a document shows, edit `documents.json` (each section is one query) or ask with `/customise`.
