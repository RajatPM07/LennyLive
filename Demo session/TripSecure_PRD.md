# PRD: TripSecure+ — New Business Issuance Flow on ARTEMIS (TCS BaNCS)
**Product:** TripSecure+ (Product Code: 4233)
**Platform:** ARTEMIS / TCS BaNCS
**Transaction Type:** New Business
**Version:** 1.0 — Draft
**Author:** Product Management
**Date:** March 2026
**Status:** Draft — For Review

---

## Table of Contents

1. [Overview & Objective](#1-overview--objective)
2. [Scope](#2-scope)
3. [User Personas](#3-user-personas)
4. [Design Principles](#4-design-principles)
5. [As-Is Reference: Elevate Flow on ARTEMIS](#5-as-is-reference-elevate-flow-on-artemis)
6. [To-Be: TripSecure+ New Business Flow](#6-to-be-tripsecure-new-business-flow)
7. [Field Rationalization: Elevate → TripSecure+](#7-field-rationalization-elevate--tripsecure)
8. [Section-wise Field Specifications](#8-section-wise-field-specifications)
9. [Business Rules](#9-business-rules)
10. [Discount Logic](#10-discount-logic)
11. [Out of Scope](#11-out-of-scope)
12. [Open Items](#12-open-items)

---

## 1. Overview & Objective

TripSecure+ is ICICI Lombard's flagship single-trip international travel insurance product. It is currently live on the direct-to-customer (D2C) web channel. This PRD defines the requirements for building the **New Business issuance flow for TripSecure+ on ARTEMIS (TCS BaNCS)** — the internal policy administration platform used by bancassurance RMs, aggregators, and operations teams.

### Problem Statement

The current ARTEMIS new business flow for travel insurance is derived from the Elevate health product flow. This results in:

- **60+ fields** presented to the user in a single long-scroll form, many of which are health-specific and irrelevant to travel
- Poor field grouping — intermediary details, proposer details, discount fields, and policy configuration are interleaved without logical sequencing
- No smart defaults or session-aware pre-fills, requiring manual entry of data the system already knows (e.g., intermediary details from login)
- Travel-specific constructs (geo-scope, trip duration, traveller count) are absent from the flow entirely

### Objective

Build a purpose-built New Business issuance flow for TripSecure+ on ARTEMIS that:

- Reduces RM input to **≤ 15 mandatory fields** requiring manual entry
- Sequences fields in a travel-native logical order
- Removes all health-specific fields not applicable to travel
- Introduces travel-specific fields (geo-scope, trip dates, traveller configuration)
- Applies smart defaults and session-aware pre-fills wherever possible
- Retains all fields required by underwriting, finance, and regulatory compliance

---

## 2. Scope

### In Scope

- New Business transaction type only
- All user channels: Bancassurance RM, Online Aggregator, Direct (BOPS and HOADMIN roles)
- All plan variants under TripSecure+ (Product Code 4233)
- Discount fields applicable to travel, including IBank Discount in Lieu of Commission
- Proposer and traveller data capture
- Intermediary and channel distribution data capture
- Nominee details
- Policy issuance confirmation

### Out of Scope

- Renewals
- Endorsements (separate PRD)
- Cancellations (separate PRD)
- Technical tag specifications (owned by Tech team)
- Rating engine / premium calculation logic (owned by Blaze)
- Claims flow
- Student travel (Globetrotter) product — separate flow

---

## 3. User Personas

| Persona | Role | Context | Key Need |
|---|---|---|---|
| Bancassurance RM | Bank branch staff selling travel insurance at point of sale | Selling a ₹1,500–₹5,000 policy across a counter in under 5 minutes | Minimal fields, fast issuance |
| Online Aggregator | Partner aggregator platform issuing via API or ARTEMIS | Higher volume, more tech-savvy, needs field consistency | Predictable field behaviour, good defaults |
| ICICI Lombard Ops / HOADMIN | Internal ops team handling corrections and manual issuance | Needs full field access including back-office fields | Full field visibility, audit trail |
| Direct Customer (future) | Self-serve via bank internet banking or IL website | Wants to issue without agent assistance | Simplified flow, no jargon |

---

## 4. Design Principles

The following principles govern all field and flow decisions in this PRD:

**P1 — Trip-first sequencing**
The flow starts with trip details (destination, dates, traveller count) — not with system fields like Transaction Type or Source System. The RM's mental model is "my customer is going to Europe from 15th Feb." The flow should mirror that.

**P2 — Maximum 15 RM-touch fields**
Every field that can be system-derived, session-derived, or defaulted must be handled automatically. The RM's manual input is reserved for information only they and the customer possess.

**P3 — Progressive disclosure**
Optional covers (PED add-on, adventure sports, cruise) appear only when the RM or customer explicitly opts in. They are not shown upfront.

**P4 — Channel-aware defaults**
Fields like Intermediary Code, Sales Manager Code, and Primary Vertical should pre-populate from the logged-in user's session. Discount eligibility (e.g., IBank Discount) should be determined by system logic, not manual selection.

**P5 — Travel-native constructs**
Replace health-specific field constructs with travel equivalents. "Policy Tenure" becomes "Trip Duration." "Family Type" becomes "Traveller Configuration." "Cover Type: Floater" becomes "Geo-scope."

**P6 — Endorsement-safe issuance**
All fields captured at New Business must be stored in a way that supports future endorsement logic. Proposal Created Date must be stored and used as the governing date for discount applicability.

---

## 5. As-Is Reference: Elevate Flow on ARTEMIS

The current Elevate new business flow on ARTEMIS consists of a single long-scroll form with the following sections, presented in this order:

1. Quotation Details (source system, transaction type, intermediary, proposer, discounts)
2. Basic Details (policy dates, plan details, SI, cover type, all discount fields)
3. Intermediary Details Section
4. Channel Distribution Details
5. Proposer Details
6. Proposer Address Details
7. Basic Other Details (tracker status, co-pay, wellness fields, renewal fields)
8. Nominee Details

**Pain points identified:**
- Single scroll with 60+ fields; no section-based navigation or step indicator
- Health-specific fields (CI Waiting Period, Loyalty Bonus, Wellness Discount, Combi Flag) appear for all products including travel
- Intermediary fields require manual entry even when derivable from login session
- Trip-specific constructs entirely absent (no destination, no trip duration, no traveller count)
- Discount fields scattered across two separate sections (Quotation Details and Basic Details)

---

## 6. To-Be: TripSecure+ New Business Flow

### Flow Overview

The TripSecure+ New Business flow on ARTEMIS is structured as a **5-step wizard** with a persistent progress indicator. Each step is a distinct screen. The RM cannot proceed to the next step until all mandatory fields on the current step are complete.

```
Step 1          Step 2             Step 3                Step 4              Step 5
Trip Details → Traveller Details → Intermediary &     → Premium &        → Review &
                                   Channel Details       Discounts           Issue
```

### Step 1 — Trip Details

**Purpose:** Capture the core trip parameters that anchor the entire policy.

**Fields on this screen:**

| Field | Type | Mandatory | Default / Behaviour |
|---|---|---|---|
| Destination / Geo-scope | Dropdown | Yes | Options: Worldwide / Asia / Schengen / USA & Canada / Others |
| Trip Start Date | Date picker | Yes | Defaults to today; editable |
| Trip End Date | Date picker | Yes | Blank; must be after Trip Start Date |
| Trip Duration (Days) | Read-only | — | Auto-calculated: End Date − Start Date |
| Policy Issue Date | Date | Yes | Defaults to today; non-editable for standard issuance |
| Cover Type | Dropdown | Yes | Options: Individual / Family |
| Traveller Count | Numeric input | Yes | Min 1; triggers traveller cards in Step 2 |
| Plan Variant | Dropdown | Yes | Options per TripSecure+ rate structure (Standard / Silver / Gold / Platinum) |
| Sum Insured (USD) | Dropdown | Yes | Options: 50,000 / 100,000 / 250,000 / 500,000 — per geo-scope rules |
| Inward Date | Date | Yes | Defaults to today; non-editable |

**Business rules for this step:**
- Trip End Date cannot precede Trip Start Date
- Trip Start Date cannot be in the past
- Sum Insured options shown are filtered by Destination / Geo-scope (e.g., Schengen requires minimum USD 50,000)
- Policy Expiry Date = Trip End Date (auto-set; no separate field needed)
- Policy Tenure field from Elevate is **replaced** by Trip Duration (calculated)

---

### Step 2 — Traveller Details

**Purpose:** Capture proposer and all traveller information. One card per traveller.

**Proposer Sub-section:**

| Field | Type | Mandatory | Default / Behaviour |
|---|---|---|---|
| Proposer Search | Text + Search icon | Yes | Lookup by customer ID; auto-fills name, DOB, contact |
| Proposer Full Name | Text | Yes | Auto-filled from lookup; editable |
| Date of Birth | Date | Yes | Auto-filled from lookup; editable |
| Proposer Age | Read-only | — | Auto-calculated from DOB |
| Proposer Contact Number | Text | Yes | Auto-filled from lookup; editable |
| Proposer Email ID | Text | Yes | Auto-filled from lookup; editable |
| Proposer also a Traveller? | Radio (Yes / No) | Yes | If Yes, first traveller card is pre-filled from proposer data |
| Proposer Pin Code | Text + Search | Yes | Auto-derives Zone and Direction |
| Zone | Dropdown | Yes | Auto-derived from pin code; editable |
| Opted Zone | Dropdown | No | Editable override |
| Annual Gross Income | Text | No | Optional; retain for regulatory reporting |
| GST No | Text | No | Optional |

**Traveller Cards (one per traveller, count driven by Step 1):**

| Field | Type | Mandatory | Default / Behaviour |
|---|---|---|---|
| Traveller Full Name | Text | Yes | Pre-filled if proposer is traveller 1 |
| Date of Birth | Date | Yes | Pre-filled if proposer is traveller 1 |
| Age | Read-only | — | Auto-calculated |
| Passport Number | Text | Yes | Manual entry |
| Relationship to Proposer | Dropdown | Yes | Self / Spouse / Child / Parent / Other |
| PED Declaration | Radio (Yes / No) | Yes | If Yes, surfaces PED add-on prompt |

**PED Add-on prompt (conditional — only if any traveller selects PED = Yes):**
> "One or more travellers have declared a Pre-Existing Disease. Would you like to add PED cover? This will affect the premium. [Add PED Cover] [Skip]"

---

### Step 3 — Intermediary & Channel Details

**Purpose:** Capture intermediary and channel distribution data. Maximum pre-fill from session.

**Intermediary Details Sub-section:**

| Field | Type | Mandatory | Default / Behaviour |
|---|---|---|---|
| Intermediary Code | Text + Search | Yes | Pre-filled from logged-in session where available |
| Intermediary Name | Text | Yes | Auto-filled from lookup; read-only |
| Intermediary Category | Dropdown | Yes | Auto-filled from lookup; read-only |
| Centralised Flag | Dropdown | Yes | Auto-filled; read-only |
| IL Location | Text | No | Auto-filled |
| Sales Manager Code | Text + Search | Yes | Pre-filled from session |
| Sales Manager Name | Text | Yes | Auto-filled from SM Code |
| Banking ID | Text | No | Optional |
| Primary Vertical | Text | Yes | Auto-filled |
| Secondary Vertical | Text | No | Auto-filled |

**Channel Distribution Details Sub-section:**

| Field | Type | Mandatory | Default / Behaviour |
|---|---|---|---|
| Channel / Partner Vertical Name | Text + Search | No | Optional |
| SP Code | Text + Search | No | Optional |
| SP Name | Text | No | Auto-filled from SP Code |
| RM Code (Partner) | Text | No | Optional |
| Branch Code | Text + Search | No | Optional |
| Branch Name / Sol ID | Text | No | Auto-filled |
| Customer ID (Partner) | Text | No | Optional |
| Partner CRM / Lead ID | Text | No | Optional |
| Banca 1 | Text | No | Optional |
| Banca 2 | Text | No | Optional |
| Banca 3 | Text | No | Optional |
| Secondary RM Code | Text | No | Optional |

---

### Step 4 — Premium & Discounts

**Purpose:** Display the computed premium and capture applicable discount inputs. Only travel-relevant discounts shown.

**Premium Summary Sub-section (read-only, system-generated):**

| Field | Behaviour |
|---|---|
| Base Premium | Computed by Blaze rating engine |
| PED Add-on Premium | Shown only if PED opted in Step 2 |
| Adventure Sports Add-on Premium | Shown only if opted |
| Total Premium (pre-discount) | Computed |
| Applicable Discounts | Itemised |
| Total Premium Payable | Final computed value |
| Premium Frequency | Defaulted to Full; non-editable for travel |

**Discount Fields (only the following are applicable for TripSecure+):**

| Field | Type | Mandatory | Default | Applicable? |
|---|---|---|---|---|
| Discount in Lieu of Commission (IBank) | Dropdown | No | — | Yes — see Section 10 |
| Online / Direct Sourcing Discount | Dropdown | No | No | Yes |
| NRI Advantage | Dropdown | No | — | Yes — if applicable |
| Vaccination Discount | Dropdown | No | No | Review with UW |
| Voluntary Deductible | Dropdown | No | — | Review with UW |
| Network Advantage Discount | Dropdown | No | — | No — remove for travel |
| ICICI Group Employee Discount | Dropdown | No | — | Review with UW |
| Cross Sell Discount | Dropdown | No | No | Review with UW |
| CIBIL Score Range | Dropdown | No | — | No — remove for travel |

> **Note:** Fields marked "Review with UW" require underwriting sign-off on applicability before go-live. They should be conditionally hidden pending that confirmation.

**Other fields retained in this step:**

| Field | Type | Mandatory | Default | Notes |
|---|---|---|---|---|
| Business Type | Dropdown | Yes | Intermediary | Locked for most channels |
| Transaction Type | Dropdown | Yes | New Business | Locked |
| Source System | Dropdown | Yes | TCS BaNCS | Locked; system-set |
| Sub-Product Code | Text | No | System-set | Auto-populated from plan selection |
| Application Number | Text | Yes | Manual / system | Required for issuance |
| S. Tax Exemption Category | Dropdown | No | No Exemption | Retain for regulatory |
| Auto-Debit Flag | Dropdown | No | — | Retain; optional |
| LAN No | Text | No | — | Retain; optional |
| PF Customer ID | Text | No | — | Retain; optional |

---

### Step 5 — Review & Issue

**Purpose:** Full summary of all entered data before final issuance. RM reviews and confirms.

**Sections displayed (read-only):**
- Trip Details summary
- Traveller(s) summary
- Intermediary summary
- Premium & Discount summary
- Nominee details (with option to add/edit)

**Nominee sub-section:**

| Field | Type | Mandatory |
|---|---|---|
| Nominee Name | Text | Yes |
| Nominee Relationship | Dropdown | Yes |
| Nominee Date of Birth | Date | Yes |
| Nominee Share % | Numeric | Yes (must total 100%) |

**Final action buttons:**
- [Save as Draft] — saves without issuing
- [Issue Policy] — triggers Blaze rating call and policy issuance
- On successful issuance: displays Policy Number and triggers policy document dispatch to proposer email

---

## 7. Field Rationalization: Elevate → TripSecure+

... (Section Content Intentionally Matched to User Prompt) ...

---

## 12. Open Items

| # | Item | Owner | Priority | Status |
|---|---|---|---|---|
| OI-01 | Blaze response tag behaviour when IBank Discount is suppressed — should the tag return null, zero, or be absent from the response? | Tech / Blaze team | High | Open |
| OI-02 | Financial exposure of incorrectly applied IBank Discount on pre-5th Dec 2025 policies — need a count of affected transactions and remediation plan | Finance / Ops | High | Open |
| OI-03 | UW confirmation on which discount fields are applicable to TripSecure+: Vaccination Discount, Voluntary Deductible, ICICI Group Employee Discount, Cross Sell Discount, Co-Pay | Underwriting | High | Open |
| OI-04 | Confirmation of valid Sum Insured tiers per geo-scope per UW rate table | Underwriting | High | Open |
| OI-05 | Confirmation of maximum trip duration (180 days assumed) | Underwriting | Medium | Open |
| OI-06 | Coverage in Preferred Network Only — applicable to travel or not? | Underwriting | Medium | Open |
| OI-07 | Co-Pay applicability for TripSecure+ | Underwriting | Medium | Open |
| OI-08 | NRI Advantage eligibility for travel | Underwriting | Medium | Open |
| OI-09 | Nirman ID / Nirman Reason — applicable to travel channel? | Ops | Low | Open |
| OI-10 | Tracker Status / Tracker Remarks / Manual Trigger — retain for travel ops or remove? | Ops | Low | Open |
| OI-11 | Confirm Passport Number is mandatory at issuance or can be captured later | Underwriting / Compliance | Medium | Open |

---

*End of Document*
