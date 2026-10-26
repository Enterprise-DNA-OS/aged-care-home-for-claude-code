# The rules the compliance check uses

`npm run ac -- compliance` (and `/compliance`) checks the records against the fifteen rules below. Each one names its source, what a breach looks like in the data, and the setting it uses. These are records checks, not legal or clinical advice. Rules change: Australia moved to the Aged Care Act 2024 and the Aged Care Rules 2025 on 1 November 2025, and the Commission is still updating its guidance. When a source changes, update this file and the check in `scripts/ac.mjs` together. Sources checked 26 October 2026.

## Australia

**R1. SIRS Priority 1 within 24 hours.** A Priority 1 reportable incident is notified to the Aged Care Quality and Safety Commission within 24 hours of the provider becoming aware of it. Priority 1 covers an incident that caused, or could reasonably have been expected to cause, physical or psychological injury or discomfort needing medical or psychological treatment, one where there are reasonable grounds to report to police, an unexplained absence reported to police, and an unexpected death.
Source: [Provider handbook, 3g Incident management and the Serious Incident Response Scheme](https://www.agedcarequality.gov.au/provider-handbook/provider-requirements/3g-incident-management-and-serious-incident-response-scheme).
Breach: an incident with `sirs_priority = 1`, no `reported_at`, and more than 24 hours since `aware_at`.

**R2. SIRS Priority 2 within 30 days.** Every other reportable incident is notified within 30 days of becoming aware.
Source: as R1.
Breach: `sirs_priority = 2`, no `reported_at`, more than 30 days since `aware_at`.

The eight reportable incident types are recorded in `sirs_type`: unreasonable use of force, unlawful sexual contact or inappropriate sexual conduct, psychological or emotional abuse, unexpected death, stealing or financial coercion by a staff member, neglect, inappropriate use of a restrictive practice, and unexplained absence from care. The CLI suggests a priority from the injury and the type; the person reporting decides.

**R3. Informed consent for every restrictive practice.** A restrictive practice is used only as a last resort, and only with the informed consent of the older person or their restrictive practices substitute decision-maker. The only exception is an emergency, and then the decision-maker is told as soon as possible.
Source: [Restrictive practices provider resources](https://www.agedcarequality.gov.au/quality-standards/restrictive-practices-provider-resources); Aged Care Rules 2025.
Breach: a restrictive practice in use at an Australian home with no `consent_on`.

**R4. A behaviour support plan, and a review that is not overdue.** Anyone with a restrictive practice applied has a behaviour support plan as part of their care and services plan, and the practice is monitored and regularly reviewed.
Source: as R3; [Restrictive practices in residential aged care](https://www.health.gov.au/topics/aged-care/providing-aged-care-services/training-and-guidance/restrictive-practices-in-aged-care-a-last-resort).
Breach: no `behaviour_support_plan_on`, or `review_due_on` in the past.

**R5. A registered nurse on site 24 hours a day.** Residential care homes have at least one registered nurse on site and on duty 24 hours a day, unless the department has granted an exemption.
Source: [24/7 registered nurse cover and care minutes](https://www.agedcarequality.gov.au/providers/clinical-governance/247-registered-nurse-cover-and-care-minutes).
Breach: any stretch of a day in the last 14 days not covered by an RN shift on the roster. The check reads the roster, so a shift worked but not entered shows as a gap.

**R6. Care minutes at or above the home's target.** Each home has its own care minutes target, set from its residents' needs, around a sector average of 215 minutes per resident per day including 44 registered nurse minutes. Registered nurses, enrolled nurses and personal care workers count. The target is met on average over each quarter.
Source: [Care minutes in residential aged care](https://www.health.gov.au/our-work/care-minutes-registered-nurses-aged-care/care-minutes); Strengthened Quality Standards Outcome 2.8.
Breach: direct care minutes per resident per day over the last 28 days below `homes.care_minutes_target`. This is an early warning against a quarterly average. Break time (`shifts.break_minutes`) is taken out.

**R7. Registered nurse minutes at or above the target.** As R6, for `homes.rn_minutes_target`. Enrolled nurse minutes count toward the RN target up to 10% of it.
Source: as R6.

**R8. No nurse rostered with an expired registration.** Nurses hold current registration with the Nursing and Midwifery Board of Australia through Ahpra (in New Zealand, a current annual practising certificate from the Nursing Council).
Source: [Ahpra, registration](https://www.ahpra.gov.au/Registration.aspx); [Nursing Council of New Zealand](https://www.nursingcouncil.org.nz/).
Breach: an RN or EN with `registration_expires_on` in the past and a shift in the last 14 days.

**R9. No expired police certificate or worker screening clearance.** Every aged care worker and responsible person holds a police certificate or an NDIS worker screening clearance. The department's guidance treats a police certificate as current for three years.
Source: [Aged care worker screening guidance material](https://www.health.gov.au/sites/default/files/2026-03/aged-care-worker-screening-guidance-material_0.pdf).
Breach: `screening_expires_on` in the past for a current staff member. Set the date to three years from the certificate, or the clearance's own expiry.

**R10. Quality indicator data by the 21st.** Residential providers submit quality indicator data every quarter through the provider portal, no later than the 21st day of the month after the quarter ends (21 October, 21 January, 21 April, 21 July). No late submissions and no extensions.
Source: [Quality indicators](https://www.agedcarequality.gov.au/quality-indicators); National Aged Care Mandatory Quality Indicator Program Manual.
Breach: no `qi_submissions` row for an Australian home for the last quarter after its due date.

**R11. Open disclosure after harm.** When something goes wrong that harmed or could have harmed a person, the provider talks openly with them (or their representative), apologises, and explains what will change.
Source: [Open disclosure](https://www.agedcarequality.gov.au/resources/open-disclosure).
Breach: an incident with an injury, a SIRS type or a Section 31 notification, more than 7 days old, with no `open_disclosure_on`. Seven days is a house setting (`OPEN_DISCLOSURE_DAYS`).

## New Zealand

**R12. The first interRAI within 21 days of admission.** Under the Age Related Residential Care Services Agreement with Health New Zealand, the first interRAI Long Term Care Facility assessment is completed within 21 days of admission.
Source: [Health New Zealand aged residential care provider agreements](https://tewhatuora.govt.nz/for-the-health-sector/aged-residential-care/te-whatu-ora-aged-residential-care-provider-agreements), clause D16.2, as cited in Ministry of Health certification audit reports.
Breach: a permanent resident admitted more than 21 days ago with no interRAI on or after admission.

**R13. interRAI reassessed at least six-monthly.** And at any significant change in health status.
Source: as R12.
Breach: the latest interRAI more than 182 days old.

**R14. The long-term care plan within 21 days.** Based on the interRAI assessment.
Source: as R12.
Breach: a permanent resident admitted more than 21 days ago with no care plan review recorded.

**R15. Section 31 notifications to HealthCERT.** Certified providers notify HealthCERT under section 31 of the Health and Disability Services (Safety) Act 2001. For aged residential care this includes every pressure injury at stage 3 or worse (stage 3, stage 4, unstageable and suspected deep tissue injury, mucosal included), wherever the resident developed it, on the dedicated form.
Source: [Health Quality and Safety Commission, Section 31 reporting of pressure injuries](https://hqsc.govt.nz/news/change-to-reporting-of-mucosal-pressure-injuries-under-section-31); HealthCERT bulletins.
Breach: an incident with `s31_required` not reported after 48 hours. The Act asks for notification as soon as reasonably practicable; 48 hours is a house setting (`S31_WAIT_HOURS`).

## Also in the records, not a rule check

- **Monthly care statements** (Australia). The department's guide asks for wellbeing activities, medication changes, appointments, and nutrition and weight each month, with diagnoses, wounds and falls where relevant, using an identifier such as initials and birth year. The government has said they will become mandatory; check the [current guide](https://www.health.gov.au/our-work/monthly-care-statements-for-residential-aged-care/about). `npm run ac -- statement` and `npm run docs -- monthly-care-statement` build them.
- **The quality indicators** themselves: `npm run ac -- qi` counts pressure injuries, restrictive practices, unplanned weight loss (5% or more, and consecutive), falls and falls with major injury, polypharmacy (nine or more regular medicines) and antipsychotics, hospitalisation, and staff who left. Activities of daily living, incontinence care, consumer experience and quality of life come from the tools and surveys the home runs.
