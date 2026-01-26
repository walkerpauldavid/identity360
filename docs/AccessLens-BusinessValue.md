# AccessLens: Identity 360 Access Model
## Business Value Narrative & User Stories

---

## Executive Summary

AccessLens transforms the fundamental IGA question — **"Who has access to what, and why?"** — from a complex, time-consuming investigation into an intuitive, visual exploration experience. By presenting identity access as an interconnected graph rather than disconnected tables and reports, AccessLens enables stakeholders across the organization to understand, verify, and govern access in seconds rather than hours.

---

## The Problem We're Solving

### The Classic IGA Challenge

Every organization with an IGA solution faces the same fundamental questions:

1. **Who has access?** — Which identities can access a given resource?
2. **What access do they have?** — What entitlements does a specific person hold?
3. **Why do they have it?** — Through what mechanism was access granted?
4. **Is it appropriate?** — Does this access align with policy and business need?
5. **Is it compliant?** — Has this access been reviewed and approved?

### Current Pain Points

| Challenge | Impact |
|-----------|--------|
| **Fragmented Data** | Access information scattered across multiple screens, reports, and systems |
| **Complex Relationships** | Indirect access through roles, groups, and policies is difficult to trace |
| **Time-Intensive Investigations** | Simple questions like "why does John have access to SAP?" take 30+ minutes to answer |
| **Compliance Blind Spots** | Difficult to see at-a-glance which access is approved vs. pending review |
| **Overlapping Assignments** | No visibility into redundant access granted through multiple paths |
| **Audit Preparation** | Gathering evidence for auditors requires manual data collection |

### The Cost of the Status Quo

- **Hours wasted** on access investigations that should take minutes
- **Compliance risks** from access that falls through the cracks
- **Audit findings** due to inability to demonstrate access justification
- **Security exposure** from undetected excessive or orphaned access
- **Frustrated stakeholders** who can't get answers to simple questions

---

## The AccessLens Solution

AccessLens provides a **unified, visual access model** that answers "who has access and why" through an intuitive graph-based interface. Instead of navigating multiple screens and reports, stakeholders see the complete access picture in one view.

### Core Capabilities

| Capability | Business Value |
|------------|----------------|
| **Identity-Centric View** | Start from any identity and see all their access across all systems |
| **Resource-Centric View** | Start from any entitlement and see everyone who has access |
| **Multi-Path Visualization** | Instantly identify when access is granted through multiple overlapping sources |
| **Compliance Status at a Glance** | Color-coded indicators show approved, pending, and non-compliant access |
| **Assignment Reasoning** | Understand HOW access was granted (direct, inherited, policy-based, external) |
| **Validity Tracking** | See time-limited vs. permanent assignments with expiration warnings |
| **Violation Detection** | Immediate visibility into policy violations and SoD conflicts |
| **Cross-Filtering** | Click any element to filter the entire view and trace relationships |

---

## User Personas & Stories

### 1. IGA Administrator

**Profile:** Technical administrator responsible for managing the IGA platform, troubleshooting access issues, and supporting other stakeholders.

**Current Pain Points:**
- Spends significant time answering "why does X have access to Y?" questions
- Must navigate multiple screens to piece together access paths
- Difficult to explain complex inheritance chains to non-technical users
- Troubleshooting provisioning issues requires manual log analysis

#### User Stories

> **US-1.1:** As an IGA Administrator, I want to **see all access for an identity in a single view** so that I can quickly answer questions from managers and auditors without navigating multiple screens.

> **US-1.2:** As an IGA Administrator, I want to **trace the complete path from identity to entitlement** so that I can understand and explain why a specific access exists (role membership, policy assignment, direct grant, or external/unmanaged).

> **US-1.3:** As an IGA Administrator, I want to **identify entitlements with multiple assignment paths** so that I can detect redundant access and recommend cleanup to simplify the access model.

> **US-1.4:** As an IGA Administrator, I want to **filter by assignment reason type** (Direct, Implicit, External) so that I can focus on specific categories of access during troubleshooting or analysis.

> **US-1.5:** As an IGA Administrator, I want to **see which access was granted outside of IGA** (External/unmanaged) so that I can identify governance gaps and work to bring that access under management.

**Value Delivered:**
- Reduce time spent on access investigations by **70-80%**
- Provide clear, visual explanations to non-technical stakeholders
- Proactively identify and remediate access model complexity

---

### 2. Compliance Administrator / Auditor

**Profile:** Responsible for ensuring access complies with policy, preparing for audits, and demonstrating regulatory compliance.

**Current Pain Points:**
- Gathering evidence for auditors is manual and time-consuming
- Difficult to prove that all access has been reviewed and approved
- No easy way to identify access that violates policy
- Reporting on compliance status requires custom report development

#### User Stories

> **US-2.1:** As a Compliance Administrator, I want to **see the compliance status of every entitlement at a glance** (Approved, Not Approved, Pending) so that I can quickly identify access requiring attention.

> **US-2.2:** As a Compliance Administrator, I want to **filter to show only non-compliant or pending access** so that I can focus my review efforts on items that need action.

> **US-2.3:** As a Compliance Administrator, I want to **see all identities with access to a sensitive resource** along with their approval status so that I can demonstrate compliance to auditors.

> **US-2.4:** As a Compliance Administrator, I want to **identify access with policy violations** so that I can initiate remediation before audits.

> **US-2.5:** As a Compliance Administrator, I want to **see time-limited access and upcoming expirations** so that I can ensure temporary access doesn't become permanent.

> **US-2.6:** As a Compliance Administrator, I want to **export the visual access model as evidence** so that I can include it in audit documentation.

**Value Delivered:**
- Reduce audit preparation time by **60-70%**
- Demonstrate compliance posture in real-time
- Proactively identify and remediate compliance gaps before audits

---

### 3. Entitlement / Resource Owner

**Profile:** Business owner responsible for a specific application, resource, or entitlement. Accountable for who has access to their resource.

**Current Pain Points:**
- Doesn't understand the technical IGA interface
- Can't easily see who has access to their resources
- Access certification campaigns provide lists without context
- No visibility into HOW people got access to their resource

#### User Stories

> **US-3.1:** As an Entitlement Owner, I want to **see all identities who have access to my resource in one view** so that I can verify that only appropriate people have access.

> **US-3.2:** As an Entitlement Owner, I want to **understand why each person has access** (direct assignment, role membership, policy) so that I can make informed certification decisions.

> **US-3.3:** As an Entitlement Owner, I want to **see the job title and department of each person with access** so that I can verify business appropriateness without looking up each person.

> **US-3.4:** As an Entitlement Owner, I want to **identify access granted through multiple paths** so that I can understand the full picture before certifying or revoking.

> **US-3.5:** As an Entitlement Owner, I want to **see which access I've already approved vs. pending my review** so that I can prioritize my certification work.

> **US-3.6:** As an Entitlement Owner, I want to **click on a policy or role to see all access it grants** so that I can understand the impact of my certification decisions.

**Value Delivered:**
- Make faster, more informed certification decisions
- Reduce inappropriate certifications ("rubber-stamping")
- Understand the full context of access without technical expertise

---

### 4. System Owner / Application Owner

**Profile:** IT owner responsible for a system or application. Accountable for security and appropriate access to their system.

**Current Pain Points:**
- No single view of all access to their system
- Difficult to understand the relationship between accounts, entitlements, and identities
- Can't easily identify orphaned accounts or excessive access
- Limited visibility into access granted through different mechanisms

#### User Stories

> **US-4.1:** As a System Owner, I want to **see all identities, accounts, and entitlements for my system in one view** so that I can understand the complete access landscape.

> **US-4.2:** As a System Owner, I want to **identify accounts without linked identities** (orphaned accounts) so that I can investigate and remediate potential security risks.

> **US-4.3:** As a System Owner, I want to **see which entitlements have the most users** so that I can prioritize security reviews for high-impact resources.

> **US-4.4:** As a System Owner, I want to **understand which roles and policies grant access to my system** so that I can work with IGA administrators to optimize the access model.

> **US-4.5:** As a System Owner, I want to **filter by compliance status** so that I can focus on access that hasn't been reviewed or approved.

> **US-4.6:** As a System Owner, I want to **see external/unmanaged access to my system** so that I can work to bring it under IGA governance.

**Value Delivered:**
- Complete visibility into system access landscape
- Identify and remediate security risks proactively
- Collaborate effectively with IGA team on access model optimization

---

### 5. Manager / Line Manager

**Profile:** People manager responsible for their direct reports. Needs to understand and certify access for their team.

**Current Pain Points:**
- Access certification lists are overwhelming and lack context
- Doesn't understand technical entitlement names
- Can't see the "big picture" of what their team can access
- No visibility into why their team members have specific access

#### User Stories

> **US-5.1:** As a Manager, I want to **see all access for one of my direct reports in a visual format** so that I can quickly understand what they can access.

> **US-5.2:** As a Manager, I want to **see which systems and applications my team member can access** so that I can verify it aligns with their job responsibilities.

> **US-5.3:** As a Manager, I want to **understand why my team member has specific access** so that I can make informed decisions during certification.

> **US-5.4:** As a Manager, I want to **compare access between team members** so that I can identify inconsistencies or excessive access.

> **US-5.5:** As a Manager, I want to **see a description of entitlements in business terms** so that I can understand what access actually means.

**Value Delivered:**
- Reduce certification fatigue and improve decision quality
- Understand team access without technical expertise
- Identify access anomalies across the team

---

## Business Value Summary

### Quantifiable Benefits

| Metric | Current State | With AccessLens | Improvement |
|--------|---------------|-----------------|-------------|
| Time to answer "who has access and why?" | 30-60 minutes | 2-5 minutes | **90% reduction** |
| Audit preparation time | 2-4 weeks | 3-5 days | **70% reduction** |
| Access certification decision time | 2-3 min/item | 30-60 sec/item | **60% reduction** |
| Compliance gaps identified pre-audit | Reactive | Proactive | **Risk reduction** |
| Stakeholder satisfaction with IGA | Low | High | **Adoption increase** |

### Strategic Benefits

1. **Democratize Access Intelligence**
   - Enable non-technical stakeholders to answer their own questions
   - Reduce dependency on IGA administrators for routine inquiries
   - Improve IGA adoption across the organization

2. **Strengthen Compliance Posture**
   - Real-time visibility into compliance status
   - Proactive identification of violations and gaps
   - Audit-ready evidence at the click of a button

3. **Reduce Security Risk**
   - Identify excessive, orphaned, and inappropriate access
   - Detect redundant access from overlapping assignments
   - Surface unmanaged/external access for governance

4. **Optimize Access Model**
   - Understand complex inheritance and policy relationships
   - Identify opportunities for simplification
   - Make data-driven decisions about role and policy design

### The Bottom Line

AccessLens transforms IGA from a **technical back-office function** into a **strategic business enabler**. By making access intelligence visual, intuitive, and accessible to all stakeholders, organizations can:

- **Answer the fundamental question** — "Who has access to what, and why?" — in seconds
- **Demonstrate compliance** to auditors with confidence
- **Empower business owners** to govern their own resources
- **Reduce risk** through proactive identification of access issues
- **Save time** across all personas who interact with identity governance

---

## Appendix: Feature Mapping to User Stories

| Feature | User Stories Supported |
|---------|----------------------|
| Identity-centric graph view | US-1.1, US-5.1, US-5.2 |
| Resource-centric graph view | US-2.3, US-3.1, US-4.1 |
| Compliance status indicators | US-2.1, US-2.2, US-3.5, US-4.5 |
| Multi-path visualization | US-1.3, US-3.4 |
| Assignment reason filtering | US-1.4, US-1.5, US-3.2, US-5.3 |
| Validity period display | US-2.5 |
| Violation detection | US-2.4 |
| Cross-lane filtering | US-3.6, US-4.4 |
| Identity details (title, dept) | US-3.3, US-5.4 |
| System aggregation view | US-4.1, US-4.3 |
| External access identification | US-1.5, US-4.6 |

---

*Document Version: 1.0*
*Last Updated: January 2026*
