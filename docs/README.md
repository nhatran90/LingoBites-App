# Documentation

This directory contains documentation for **LingoBites**.

## Current MVP plan docs

These are the active docs for the LingoBites Offline Review MVP (SETE-92 and related tasks).

| Path                            | Purpose                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------- |
| `01_Product_Overview.md`        | Short product overview                                                          |
| `02-investor/`                  | Investor-facing overview, pitch outline, business model, GTM, FAQ               |
| `03-operations/`                | Cost estimate and operational notes outside BA                                  |
| `architecture/feature-map.md`   | Diagram of the features currently live in the app (screens, flows, server APIs) |
| `architecture/lesson-design.md` | Single spec of every lesson type, live and upcoming, with diagrams (read first) |
| `content/`                      | Lesson spec template for content authors, with a filled example                 |
| `superpowers/`                  | Supporting specs and implementation plans, not part of the main reading flow    |
| `implementation-notes/`         | Notes accumulated during MVP implementation                                     |
| `tasks/`                        | Task briefs for the current MVP sprint                                          |
| `prompts/`                      | Prompt templates used by the MVP                                                |
| `archive/`                      | Superseded audits and QA reports (no longer match the code; kept for history)   |

## How to read

Start with `01_Product_Overview.md` for context.

## Legacy / historical docs (ScanLearnEnglish)

The `legacy/01-ba/` directory contains the original ScanLearnEnglish business-analysis and specification set. This material is **archived for historical reference only** — it is not current MVP documentation. Do not modify it.

| Path                                         | Purpose                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------- |
| `legacy/01-ba/README.md`                     | Entry point for the legacy BA set by role and milestone                          |
| `legacy/01-ba/01-schema/`                    | Canonical AI output schema and fixtures (ScanLearnEnglish)                       |
| `legacy/01-ba/02-technical/`                 | Technical spec, implementation plan, modular architecture, feature flags, AI/OCR |
| `legacy/01-ba/02-technical/release-configs/` | Named release presets (JSON) for feature-flag rollouts                           |
| `legacy/01-ba/03-requirements/`              | FR, BR, user stories, NFR, traceability                                          |
| `legacy/01-ba/04-product/`                   | Product, business, phase scope, roadmap                                          |
| `legacy/01-ba/05-qa/`                        | QA plan                                                                          |
| `legacy/01-ba/06-design/`                    | User flow, wireframes, theme system                                              |
| `legacy/01-ba/07-release/`                   | Production readiness, privacy, store assets                                      |
| `legacy/01-ba/08-operations/`                | Analytics, risks, AI key/security strategy                                       |

## Rules to avoid duplication

Overview files must stay short. For new MVP work, place product requirements, business rules, schema, test cases, analytics events, release gates, and detailed implementation guidance in the appropriate current-MVP directory. Do not add new content to `legacy/`.
