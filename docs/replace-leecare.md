# Moving off Leecare

Leecare's reports export to Excel. Save each one as CSV and bring it in with one command. Three files cover what most homes need on day one: the resident list, the weights and the incident register. Do it home by home.

## Before you start

1. Set up your homes (edit the `homes` rows in `supabase/seed.sql` for a demo, or ask Claude Code to add yours: code, name, state or NZ, beds, and the care minutes targets the department gave you).
2. Add your staff with their registration numbers and expiry dates, and their police certificate expiry dates. Ask Claude Code; it writes the rows.
3. Delete the demo data first: remove `.data/` and run `npm run migrate`.

## 1. Residents

Export the current resident list (and respite) to CSV, then:

```
npm run ac -- import leecare residents residents.csv --home=WATTLE --dry-run
npm run ac -- import leecare residents residents.csv --home=WATTLE
```

| Column read (first one found) | Goes to |
|---|---|
| `Resident Name` / `Resident` / `Name` (either "Surname, First" or "First Surname"), or `First Name` plus `Surname` | first and last name |
| `Admission Date` / `Admitted` / `Date of Admission` / `Entry Date` | admitted on (DD/MM/YYYY or YYYY-MM-DD) |
| `Date of Birth` / `DOB` | born on |
| `Room` / `Room No` / `Bed` | room |
| `Care Type` / `Status` / `Stay Type` (contains "respite") | respite, otherwise permanent |
| `AN-ACC Class` / `Funding Class` / `Level of Care` / `Care Level` | care level |
| `GP` / `Doctor` | GP |
| `Next of Kin` / `Representative` / `NOK` / `Primary Contact` | representative |
| `NOK Email` / `Representative Email` / `Contact Email` | representative email |

Rows without a name or an admission date are listed and skipped. Running it again updates the same residents (matched on name and admission date); it never duplicates.

## 2. Weights

Export the weight observations (a year is plenty):

```
npm run ac -- import leecare weights weights.csv --home=WATTLE
```

Reads `Resident Name` (or `Resident`, `Name`, `Resident ID`), `Weigh Date` (or `Date`, `Recorded`, `Observation Date`) and `Weight (kg)` (or `Weight`, `Kg`, `Value`). A resident it cannot match by name is listed and skipped.

## 3. Incidents

Export the incident register:

```
npm run ac -- import leecare incidents incidents.csv --home=WATTLE
```

Reads `Incident Number`, `Incident Date` (with time), `Resident Name`, `Incident Type`, `Injury`, `SIRS Priority`, `SIRS Reported`, `SIRS Reference`, `Description`, `Date Closed`. The type becomes a fall, behaviour, medication, skin, absence, death or complaint from the words in it. An injury that mentions treatment, a fracture, hospital or sutures becomes "needs treatment". When a SIRS priority is present the SIRS type is read from the incident type; check those after the import with `npm run ac -- incidents --all`.

## What does not come across

- **Medication charts.** Keep your electronic medication chart. This records the changes residents and families are told about, and the number of regular medicines for the polypharmacy indicator.
- **Progress notes and care plans as documents.** Bring the last care plan review date for each resident (ask Claude Code to add them) so the review clock starts right. Keep the old notes in Leecare's archive or export them as PDFs for the record.
- **Assessments history.** Enter the latest of each kind per resident (`/assess`) so the due dates are right. Older ones stay in the export.
- **Rosters.** Shifts come from your rostering system; ask Claude Code to map its export into `shifts` (home, staff, role, start, end, break).

Your columns are different? Open the file in Claude Code and ask it to map them. It changes `importCmd` in `scripts/ac.mjs` and adds the case to the smoke test.

Check the counts against Leecare before you switch: residents per home, incidents in the last quarter, the latest weight for five residents.
