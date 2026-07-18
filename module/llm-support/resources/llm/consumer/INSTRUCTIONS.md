# LLM Support Instructions
Task-oriented guidance and operations for generating Travetto projects and features.

## Core Intent
Use this module to discover and execute generation-ready guidance for:
- project bootstrap and model backend selection
- web/controller/service and interceptor creation
- auth, uploads, model-indexed/model-query flows
- lint/test quality enablement
- email generation and delivery sub-operations

## Scope Decisions
Do not recommend excluded operations unless explicitly requested:
- log:config
- log:instrumentation
- eslint:profile
- test:mock-service

## Usage Workflow
1. Discover command shapes with `npx trv cli:schema` when uncertain.
2. Request recommendations with `npx trv llm:support:recommend`.
3. Select bundles/workflows/operations and generate plan-first changes.
4. Clean up formatting and style violations by running `npx trv lint --fix`.
5. Validate with targeted tests and compile checks.

## Framework Development Principles
- Prefer explicit contracts over implicit behavior; generated guidance should map to named operations, modules, and outcomes.
- Keep module boundaries clear: routing, service logic, persistence, and transport concerns should remain separable.
- Optimize for composability; recommendations should combine cleanly without hidden coupling.
- Default to safe behavior (plan-first, dry-run-first, minimal scope changes) and require explicit opt-in for destructive actions.
- Favor deterministic outputs so repeated runs with the same inputs produce equivalent guidance.

## Best Practices
- Schema-first boundaries: define input/output contracts with schema classes at ownership boundaries.
- Dependency clarity: always separate required modules from optional adapters and explain why optional items exist.
- Compatibility discipline: preserve stable operation ids and tool names; additive changes are preferred over breaking renames.
- Validation before confidence: verify recommendations against command shape, run `npx trv lint --fix` to clean up formatting, then verify generated output with targeted tests.
- Incremental adoption: start with baseline bundles and layer advanced features only when requirements justify complexity.
- Explain tradeoffs: when multiple stack choices exist, provide capability-based selection criteria (query, indexed, blob, expiry, etc.).
- Keep examples production-oriented: avoid toy guidance that skips error handling, configuration boundaries, or testability.

## Change Quality Expectations
- Every new operation should include clear intent, required modules, optional modules, and verification checks.
- Every guidance expansion should include corresponding tests for discoverability and metadata integrity.
- Every consumer-facing behavior change should be reflected in these instructions so agent behavior stays aligned with framework expectations.