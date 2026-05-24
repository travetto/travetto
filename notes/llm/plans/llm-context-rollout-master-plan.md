# Travetto LLM Context Rollout Master Plan and Progress

Date: 2026-05-24
Branch: llm-support

## Objective

Create durable, high-accuracy LLM context for Travetto by delivering per-module dual-role docs (consumer and maintainer), enforcing coverage and quality gates, and synthesizing final task-oriented guidance in a dedicated llm-support module.

## Scope

- In scope:
  - Per-module LLM folders with six files per module.
  - Role split: consumer guidance and maintainer guidance.
  - README-grounded consumer narratives (not API lists only).
  - Complete decorator coverage and non-internal utility coverage in consumer docs.
  - Command schema alignment for CLI-facing modules via npx trv cli:schema.
  - Final synthesis into module/llm-support after module-level compliance.
- Out of scope:
  - Publishing llm content in package artifacts.
  - Replacing module README files as the primary product docs.

## Deliverable Model

Each covered module must provide:

- llm/consumer/OVERVIEW.md
- llm/consumer/INSTRUCTIONS.md
- llm/consumer/TIPS.md
- llm/maintainer/OVERVIEW.md
- llm/maintainer/INSTRUCTIONS.md
- llm/maintainer/TIPS.md

## Wave Plan

1. Wave 1: Core Framework
- runtime, config, schema, di, compiler, manifest

2. Wave 2: Application Surface
- cli, model, web, auth, cache, test

3. Wave 3: Platform and Tooling Support
- openapi, terminal, repo, registry, context, log

4. Wave 4+: Remaining modules
- Extend wave coverage to all remaining module/* packages not yet documented.

## Consumer OVERVIEW Contract

Every consumer OVERVIEW must include:

- What This Module Is
- Why To Use It
- When To Use It
- When Not To Use It
- Core Capabilities
- Decorators (or explicit no-decorators note)
- Utility Classes (Non-Internal) (or explicit no-utils note)
- Core APIs and Extension Points
- Typical Integration Flow (with adjacent module references)
- Practical Scenario

Quality threshold:

- Clear narrative, not only short bullet stubs.
- At least one practical scenario.
- At least one explicit decision guideline.
- API names and symbols must be accurate.

## Maintainer Guidance Contract

- Explain extension points, invariants, compatibility boundaries, and risk areas.
- Include testing expectations and integration impact notes.
- Include change-triage guidance for registration/binding/validation-sensitive updates.

## Hardening and Safety Rules

1. Accuracy hardening
- Eliminate stale/misnamed references (for example RuntimeIndex, SchemaRegistry.bind, DependencyRegistry).
- Keep decorator and utility inventories aligned with current exports.

2. Publishing safety
- Ensure llm folders are excluded from each module package.json files arrays.

3. Role consistency
- Consumer and maintainer docs must not conflict on behavior.

## Agent Tooling Contract

- Use npx trv cli:schema as the command-schema source of truth.
- Apply this check to CLI-facing modules and to final llm-support synthesis.

## Verification Gates (Per Wave and Retrofit Batch)

1. Structure
- All six role files exist per module.

2. Consumer content
- Required headings present exactly per contract.
- Decorator coverage complete and accurate.
- Non-internal utility coverage complete and accurate.
- README-grounded narrative and scenario/decision quality present.

3. Accuracy
- No stale symbol patterns.

4. Packaging
- llm excluded from package publish files arrays.

5. Tooling alignment
- CLI schema references validated where applicable.

## Final Synthesis Phase

After all module docs are compliant:

1. Create module/llm-support.
2. Synthesize role-based module knowledge into task-oriented workflows.
3. Integrate cli:schema outputs for command-discovery and argument-shape guidance.
4. Add cross-module troubleshooting and decision trees.

## Maintenance Policy

When module behavior or README changes:

1. Update consumer OVERVIEW narrative first.
2. Sync decorator and utility inventories.
3. Sync maintainer docs.
4. Re-run wave verification gates.

## Current Progress Snapshot

### Completed

- Wave 1 docs created and previously remediated for accuracy and completeness.
- Wave 2 docs created and previously remediated for accuracy and completeness.
- Wave 3 docs created for openapi, terminal, repo, registry, context, and log.
- Priority README-depth retrofits completed earlier for sparse consumer modules:
  - log, context, openapi, registry, repo
- Latest retrofit operation completed for Wave 1 and Wave 2 consumer OVERVIEW normalization:
  - standardized heading to Core Capabilities
  - removed duplicate trailing lowercase "When to use it" sections
  - normalized auth section heading to Core APIs and Extension Points
  - tightened integration-flow wording in selected Wave 1 modules
- Consumer INSTRUCTIONS/TIPS audit for Wave 1/2: no required edits.
- Verification for latest Wave 1/2 retrofit operation:
  - required heading contract: PASS
  - stale symbol scan: PASS
  - duplicate lowercase heading scan: PASS
  - publish safety check: PASS
- Wave 4 batch 1 docs created for:
  - model-indexed
  - model-memory
  - model-query
- Wave 4 batch 2 docs created for:
  - model-query-language
  - model-sql
  - model-mongo
- Wave 4 batch 3 docs created for:
  - model-elasticsearch
  - model-postgres
  - model-mysql
- Wave 4 batch 4 docs created for:
  - model-sqlite
  - model-file
  - model-firestore
- Wave 4 batch 5 docs created for:
  - model-redis
  - model-s3
  - model-dynamodb
- Wave 4 hardening completed for all model extension modules:
  - model-indexed, model-memory, model-query
  - model-query-language, model-sql, model-mongo
  - model-elasticsearch, model-postgres, model-mysql
  - model-sqlite, model-file, model-firestore
  - model-redis, model-s3, model-dynamodb
- Validation gates passed for all Wave 4 model extension hardening batches:
  - six-file structure checks
  - consumer OVERVIEW heading-contract checks
  - package publish-safety checks (llm excluded from files arrays)
- Schema hardening follow-up completed:
  - consumer contract guardrails finalized
  - maintainer compatibility/triage/checklist depth finalized
  - schema validation gates passed (structure, heading contract, publish safety)
- Non-model hardening trios completed:
  - runtime, config, di
  - compiler, manifest, cli
  - web, auth, cache
  - openapi, terminal, repo
  - registry, context, log
- Validation gates passed for each completed non-model hardening trio:
  - six-file structure checks
  - consumer OVERVIEW heading-contract checks
  - package publish-safety checks (llm excluded from files arrays)
- Auth extension coverage batch completed:
  - auth-model
  - auth-session
  - auth-web
  - auth-web-passport
  - auth-web-session
- Validation gates passed for auth extension coverage batch:
  - six-file structure checks
  - consumer OVERVIEW heading-contract checks
  - package publish-safety checks (llm excluded from files arrays)
- Tooling/service coverage batch completed:
  - email
  - image
  - eslint
- Validation gates passed for tooling/service coverage batch:
  - six-file structure checks
  - consumer OVERVIEW heading-contract checks
  - package publish-safety checks (llm excluded from files arrays)
- Email extension coverage batch completed:
  - email-compiler
  - email-inky
  - email-nodemailer
- Validation gates passed for email extension coverage batch:
  - six-file structure checks
  - consumer OVERVIEW heading-contract checks
  - package publish-safety checks (llm excluded from files arrays)
- Web transport coverage batch completed:
  - web-http
  - web-connect
  - web-rpc
- Validation gates passed for web transport coverage batch:
  - six-file structure checks
  - consumer OVERVIEW heading-contract checks
  - package publish-safety checks (llm excluded from files arrays)
- Upload/serverless/worker coverage batch completed:
  - web-upload
  - web-aws-lambda
  - worker
- Validation gates passed for upload/serverless/worker coverage batch:
  - six-file structure checks
  - consumer OVERVIEW heading-contract checks
  - package publish-safety checks (llm excluded from files arrays)
- Tooling/generator coverage batch completed:
  - doc
  - pack
  - scaffold
- Validation gates passed for tooling/generator coverage batch:
  - six-file structure checks
  - consumer OVERVIEW heading-contract checks
  - package publish-safety checks (llm excluded from files arrays)
- Data/compile utility coverage batch completed:
  - schema-faker
  - transformer
- Validation gates passed for data/compile utility coverage batch:
  - six-file structure checks
  - consumer OVERVIEW heading-contract checks
  - package publish-safety checks (llm excluded from files arrays)

- Auth core hardening batch completed:
  - auth-model
  - auth-session
  - auth-web
- Validation gates passed for auth core hardening batch:
  - six-file structure checks
  - consumer OVERVIEW heading-contract checks
  - package publish-safety checks (llm excluded from files arrays)

- Auth extension/email hardening batch completed:
  - auth-web-passport
  - auth-web-session
  - email
- Validation gates passed for auth extension/email hardening batch:
  - six-file structure checks
  - consumer OVERVIEW heading-contract checks
  - package publish-safety checks (llm excluded from files arrays)

- Tooling/media hardening batch completed:
  - image
  - eslint
  - email-compiler
- Validation gates passed for tooling/media hardening batch:
  - six-file structure checks
  - consumer OVERVIEW heading-contract checks
  - package publish-safety checks (llm excluded from files arrays)

- Final hardening wave completed:
  - email-inky
  - email-nodemailer
  - web-http
  - web-connect
  - web-rpc
  - web-upload
  - web-aws-lambda
  - worker
  - doc
  - pack
  - scaffold
  - schema-faker
  - transformer
- Validation gates passed for final hardening wave:
  - six-file structure checks
  - consumer OVERVIEW heading-contract checks
  - package publish-safety checks (llm excluded from files arrays)

### In Progress

- Full README-grounded enrichment pass for all completed modules, continuing beyond priority sparse set.
- Planning next Wave 4+ coverage beyond model/auth-extension modules.

### Pending

- Continue/complete retrofit for remaining completed modules that still need narrative-depth improvements.
- Execute quality hardening passes for both roles across remaining non-model modules.
- Continue Wave 4+ module coverage beyond model extension modules.
- Build module/llm-support synthesis after full compliance.

## Modified Files in Most Recent Retrofit Batch

- module/runtime/llm/consumer/OVERVIEW.md
- module/config/llm/consumer/OVERVIEW.md
- module/schema/llm/consumer/OVERVIEW.md
- module/di/llm/consumer/OVERVIEW.md
- module/compiler/llm/consumer/OVERVIEW.md
- module/manifest/llm/consumer/OVERVIEW.md
- module/cli/llm/consumer/OVERVIEW.md
- module/model/llm/consumer/OVERVIEW.md
- module/web/llm/consumer/OVERVIEW.md
- module/auth/llm/consumer/OVERVIEW.md
- module/cache/llm/consumer/OVERVIEW.md
- module/test/llm/consumer/OVERVIEW.md
- module/model-indexed/llm/consumer/OVERVIEW.md
- module/model-indexed/llm/consumer/INSTRUCTIONS.md
- module/model-indexed/llm/consumer/TIPS.md
- module/model-indexed/llm/maintainer/OVERVIEW.md
- module/model-indexed/llm/maintainer/INSTRUCTIONS.md
- module/model-indexed/llm/maintainer/TIPS.md
- module/model-memory/llm/consumer/OVERVIEW.md
- module/model-memory/llm/consumer/INSTRUCTIONS.md
- module/model-memory/llm/consumer/TIPS.md
- module/model-memory/llm/maintainer/OVERVIEW.md
- module/model-memory/llm/maintainer/INSTRUCTIONS.md
- module/model-memory/llm/maintainer/TIPS.md
- module/model-query/llm/consumer/OVERVIEW.md
- module/model-query/llm/consumer/INSTRUCTIONS.md
- module/model-query/llm/consumer/TIPS.md
- module/model-query/llm/maintainer/OVERVIEW.md
- module/model-query/llm/maintainer/INSTRUCTIONS.md
- module/model-query/llm/maintainer/TIPS.md
- module/model-query-language/llm/consumer/OVERVIEW.md
- module/model-query-language/llm/consumer/INSTRUCTIONS.md
- module/model-query-language/llm/consumer/TIPS.md
- module/model-query-language/llm/maintainer/OVERVIEW.md
- module/model-query-language/llm/maintainer/INSTRUCTIONS.md
- module/model-query-language/llm/maintainer/TIPS.md
- module/model-sql/llm/consumer/OVERVIEW.md
- module/model-sql/llm/consumer/INSTRUCTIONS.md
- module/model-sql/llm/consumer/TIPS.md
- module/model-sql/llm/maintainer/OVERVIEW.md
- module/model-sql/llm/maintainer/INSTRUCTIONS.md
- module/model-sql/llm/maintainer/TIPS.md
- module/model-mongo/llm/consumer/OVERVIEW.md
- module/model-mongo/llm/consumer/INSTRUCTIONS.md
- module/model-mongo/llm/consumer/TIPS.md
- module/model-mongo/llm/maintainer/OVERVIEW.md
- module/model-mongo/llm/maintainer/INSTRUCTIONS.md
- module/model-mongo/llm/maintainer/TIPS.md
- module/model-elasticsearch/llm/consumer/OVERVIEW.md
- module/model-elasticsearch/llm/consumer/INSTRUCTIONS.md
- module/model-elasticsearch/llm/consumer/TIPS.md
- module/model-elasticsearch/llm/maintainer/OVERVIEW.md
- module/model-elasticsearch/llm/maintainer/INSTRUCTIONS.md
- module/model-elasticsearch/llm/maintainer/TIPS.md
- module/model-postgres/llm/consumer/OVERVIEW.md
- module/model-postgres/llm/consumer/INSTRUCTIONS.md
- module/model-postgres/llm/consumer/TIPS.md
- module/model-postgres/llm/maintainer/OVERVIEW.md
- module/model-postgres/llm/maintainer/INSTRUCTIONS.md
- module/model-postgres/llm/maintainer/TIPS.md
- module/model-mysql/llm/consumer/OVERVIEW.md
- module/model-mysql/llm/consumer/INSTRUCTIONS.md
- module/model-mysql/llm/consumer/TIPS.md
- module/model-mysql/llm/maintainer/OVERVIEW.md
- module/model-mysql/llm/maintainer/INSTRUCTIONS.md
- module/model-mysql/llm/maintainer/TIPS.md
- module/model-sqlite/llm/consumer/OVERVIEW.md
- module/model-sqlite/llm/consumer/INSTRUCTIONS.md
- module/model-sqlite/llm/consumer/TIPS.md
- module/model-sqlite/llm/maintainer/OVERVIEW.md
- module/model-sqlite/llm/maintainer/INSTRUCTIONS.md
- module/model-sqlite/llm/maintainer/TIPS.md
- module/model-file/llm/consumer/OVERVIEW.md
- module/model-file/llm/consumer/INSTRUCTIONS.md
- module/model-file/llm/consumer/TIPS.md
- module/model-file/llm/maintainer/OVERVIEW.md
- module/model-file/llm/maintainer/INSTRUCTIONS.md
- module/model-file/llm/maintainer/TIPS.md
- module/model-firestore/llm/consumer/OVERVIEW.md
- module/model-firestore/llm/consumer/INSTRUCTIONS.md
- module/model-firestore/llm/consumer/TIPS.md
- module/model-firestore/llm/maintainer/OVERVIEW.md
- module/model-firestore/llm/maintainer/INSTRUCTIONS.md
- module/model-firestore/llm/maintainer/TIPS.md
- module/model-redis/llm/consumer/OVERVIEW.md
- module/model-redis/llm/consumer/INSTRUCTIONS.md
- module/model-redis/llm/consumer/TIPS.md
- module/model-redis/llm/maintainer/OVERVIEW.md
- module/model-redis/llm/maintainer/INSTRUCTIONS.md
- module/model-redis/llm/maintainer/TIPS.md
- module/model-s3/llm/consumer/OVERVIEW.md
- module/model-s3/llm/consumer/INSTRUCTIONS.md
- module/model-s3/llm/consumer/TIPS.md
- module/model-s3/llm/maintainer/OVERVIEW.md
- module/model-s3/llm/maintainer/INSTRUCTIONS.md
- module/model-s3/llm/maintainer/TIPS.md
- module/model-dynamodb/llm/consumer/OVERVIEW.md
- module/model-dynamodb/llm/consumer/INSTRUCTIONS.md
- module/model-dynamodb/llm/consumer/TIPS.md
- module/model-dynamodb/llm/maintainer/OVERVIEW.md
- module/model-dynamodb/llm/maintainer/INSTRUCTIONS.md
- module/model-dynamodb/llm/maintainer/TIPS.md

## Source References

- notes/llm/MODULE_LLM_INDEX.md
- notes/llm/DEVELOPMENT_GUIDELINES.md
- memories/session/plan.md (working-session retrofit detail)
