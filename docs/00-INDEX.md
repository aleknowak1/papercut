# DOC-00 — Documentation Index and Conventions

**Project codename:** PAPERCUT (placeholder — replace when a product name is chosen)
**Document owner:** Alek Nowak
**Status:** Active
**Last updated:** 2026-09-02

---

## 1. Purpose

This is the master index for all PAPERCUT project documentation. Every document in the project is listed here with its ID, purpose, and status. If a document is not in this index, it is not an official project document.

## 2. Document Set

| ID | Document | Purpose | Status |
|----|----------|---------|--------|
| DOC-00 | Index and Conventions (this file) | Map of all docs; rules for writing them | Active |
| DOC-01 | Product Specification | What we are building, for whom, and what is in/out of each version | Active |
| DOC-02 | Decision Log (ADRs) | Every significant decision, with reasoning, numbered ADR-001, ADR-002… | Active |
| DOC-03 | Architecture | Technical design: app components, company server, data flow, file formats | Active |
| DOC-04 | Change Log | Dated record of every change to software or docs | Active |
| DOC-05 | User Manual | End-user instructions, grows alongside the software | Skeleton |
| DOC-06 | Glossary | Definitions of every project-specific term | Active |
| DOC-07 | Open Questions and Risks | Unresolved items, each with an owner and a deadline | Active |
| DOC-08 | Licensing Register | Every third-party component, its verified license, obligations, and clearance status | Active |
| DOC-09 | AI Spend Policy | Rules that keep paid AI usage limited to real user results; caching, fake providers, caps | Active |
| DOC-10 | Project Tracker | Where we are, phase and feature status, what is waiting on Alek. Read this first when returning. | Active |
| DOC-11 | Development Workflow | Tools, session rhythm, roles, agents, CLAUDE.md standing orders, phase kickoff prompts | Active |
| DOC-12 | Export Prototype Measurement Report | OQ-019 measurements on real hardware and the ADR-013 decision record | Active |
| DOC-13 | Segmentation Gate Report | OQ-020 gate evidence: Smart App Control verdict, onnxruntime-node measurements, candidate paths | Active |

## 3. Conventions

### 3.1 Identifiers
- Documents are `DOC-NN`. Decisions are `ADR-NNN`. Open questions are `OQ-NNN`. Change-log entries are `CL-NNNN`. Manual sections are `M-N.N`.
- Identifiers are never reused or renumbered. A retired item is marked *Superseded* or *Closed*, never deleted.
- Cross-reference by ID, e.g. "see ADR-004", never by page or paragraph.

### 3.2 Status values
`Draft` → `Active` → `Superseded` / `Closed`. Only Active documents are authoritative.

### 3.3 Versions
Software versions follow `MAJOR.MINOR.PATCH` (e.g. 1.0.0). Scope is defined per version in DOC-01. Nothing ships in a version unless DOC-01 lists it there.

### 3.4 Change discipline
Every change to code or docs gets a DOC-04 entry with: date, ID, what changed, why, which docs were updated. If a change contradicts an ADR, a new ADR supersedes the old one first. DOC-10 (tracker) is updated in the same change.

### 3.5 Writing style
Plain English. Short sections. Tables over prose where possible. No marketing language. Assume the reader is a smart non-programmer returning after three months away.

### 3.6 Content rules
- No stylistic reference to any specific existing creator, channel, or brand appears in any project document or file.
- No bundled templates, stock photos, or sample projects are ever described as part of the product.
