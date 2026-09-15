# Maintainer Notes

## Module Role
This module owns LLM-oriented generation guidance for Travetto.

## Implementation Rules
- Keep operation metadata explicit and testable.
- Track excluded operations in `src/recommendation.ts`.
- Keep install/workflow guidance focused on direct generation workflows.
- Avoid provider-specific integrations in this phase.
- Framework Code Exposure Rule: Any code exposed to the LLM that is found within the Travetto framework MUST be exposed under a `doc/` folder (sample usage code), NEVER from `src/` or internal implementation files.
- Minimal Decorator Usage Rule: Rely on Travetto's AST reflection and sensible defaults to infer metadata rather than explicitly duplicating clear information. Omit `@Required` for non-optional properties, `@PathParam` / `@QueryParam` when parameter names match, `@Body` on POST/PUT DTO parameters, and prefer JSDoc comments over `@Description`.
- Compiler State Verification Rule: Use `npx trvc info` to check compiler server status. Active compiler servers return a JSON object with a `state` field (such as `'watch-start'`, `'compile-end'`, `'init'`). If running, no build commands are needed. Executing `npx trvc clean` is allowed and will restart the compiler upon completion. Inactive servers return empty output.

## Framework Principles
- Treat llm-support as framework guidance infrastructure, not app-specific scaffolding.
- Preserve stable public contracts (operation ids, tool names, output shapes) unless a versioned compatibility change is planned.
- Keep guidance declarative and data-driven when possible to reduce execution branching and drift.
- Favor explicit policy over convention: codify exclusions, defaults, and verification expectations in source.

## Engineering Best Practices
- Use schema classes for boundary contracts and runtime validation.
- Keep recommendations explainable: each operation should have intent, dependency rationale, and verification guidance.
- Maintain deterministic execution planning and artifact reporting for traceability.
- Prefer additive evolution of guidance catalogs and workflows over mutation of existing semantics.
- Ensure every new capability has at least one integrity test (metadata shape, discoverability, or execution coverage).
- Keep documentation synchronized with behavior changes in the same change set.
- Continuous Feedback Integration: When receiving feedback, corrections, or workflow preferences, update the maintainer `INSTRUCTIONS.md` (and consumer `INSTRUCTIONS.md` if relevant) to codify the guidance for future agent sessions.

## Compatibility And Change Discipline
- Breaking contract changes require an explicit compatibility note and migration guidance.
- New operations should avoid overlapping semantics unless distinction is documented.
- Excluded operations must remain visible in policy/tests, even when omitted from default recommendations.
- Guidance should remain monorepo-aware and avoid assumptions that only apply to single-package apps.

## Framework Coding Guidelines
- **Visibility Modifiers**: Do not use TS visibility modifiers (`private`, `protected`, or `public`). Use ECMAScript standard public by default and `#private` fields/methods when private accessibility is needed.
- **Generated Files**: `openapi.yml` (and other OpenAPI definition outputs) are generated automatically. Do not manually edit, inspect, or track changes in them directly as they will be regenerated.
- **Documentation Generation**: When modifying documentation or running doc generation, execute `npx trv doc:angular` instead of `npx trv doc`, as it produces both the module docs and the website documentation (`related/travetto.github.io`).
- **Barrel Exports**: Always check and update `__index__.ts` files when adding or removing files to ensure barrel exports are correct.
- **TypeScript Compilation**: Never invoke `tsc` directly in shell commands. The Travetto compiler (`trv`) wraps TypeScript compilation.
- **Dependency Injection and Registry Initialization**:
  - Do not use defensive null checks (e.g., `if (this.source)`) on injected dependencies (`@Inject()`).
  - If there is concern about uninitialized dependencies in scripts or tests, ensure `await Registry.init()` is called first so that all dependencies and services are properly initialized.
- **Model Query Handling**:
  - When building query filters or aggregations in model services, compose compound clauses (such as `$and`, field existence, or type constraints) directly via `ModelQueryUtil.getWhereClause(cls, ...)` rather than manually stitching backend-specific query filter objects.
  - For query types with selective pagination (such as faceting), only include relevant pagination fields (e.g., `limit` and `offset`) on `ModelQuery` rather than inheriting inapplicable options (e.g., `sort`) from `PageableModelQuery`.
- **Model Storage Lifecycle (`deleteModel`, `deleteStorage`, `truncateModel`, `truncateBlob`)**:
  - `deleteModel`, `deleteStorage`, and `truncateModel` are required methods on `ModelStorageSupport`.
  - `deleteModel` and `deleteStorage` must be idempotent and must not throw if the underlying storage/model item is not found or already deleted. Error handling must specifically check for not-found error conditions (e.g., 404, `NoSuchBucket`, `ResourceNotFoundException`, `isTableNotFoundError`) rather than indiscriminately catching and swallowing all errors. Prefer `ModelStorageUtil.runAndIgnoreNotFound(operation, notFoundPredicate)` for clean, boilerplate-free handling.
  - Truncate operations (`truncateModel`, `truncateBlob`) must never swallow not-found errors; only delete operations (`deleteModel`, `deleteStorage`) may swallow not-found errors.
  - Keep `deleteModel` (structure/DDL destruction) and `truncateModel` (record/data purge) as distinct responsibilities; `truncateModel` must purge records without dropping or altering the underlying schema, table, or storage container. In SQL (and structured datastores), truncating a non-existent table must throw an error.
  - Runtime services (such as `CacheService.purge()`) that clear data must invoke `truncateModel`, never `deleteModel`.
- **Code Maintenance & Intentional Deletions**:
  - Never restore or re-add code that was removed unless explicitly requested or approved by the user.
  - Never modify or touch files in the `archived/` directory; it is preserved for historical reasons only.
- **PR Scope & Minimal Churn**:
  - Do not touch, reformat, or rename existing code (including expanding abbreviated identifiers or variables) when it is not material to the PR. Keep changes tightly focused on the requested functionality or bug fix.
- **Code Style & Safety**:
  - Prefer declarative object definitions with inline conditional spreading (`...(condition ? { ... } : {})`) over creating mutable objects and appending properties via `if` statements.
  - Use optional chaining (`?.`) instead of non-null assertions (`!`) on schema and registry lookups (e.g., `SchemaRegistryIndex.getNestedFieldConfig(...)`).
  - Avoid redundant `String(...)` conversions inside template literals (e.g., use `` `$${field}` `` instead of `` `$${String(field)}` ``).
  - Avoid inline `.catch` invocations on promises unless strictly necessary (e.g., an unawaited promise). Prefer standard `try / catch` blocks instead.
  - Avoid creating redundant type aliases or duplicate types (e.g., introducing a short alias alongside a canonical descriptive type). Expose a single canonical descriptive type name.

## Catalog Evolution
When adding operations:
1. Add type-safe operation metadata.
2. Add workflow/install entries if module dependencies change.
3. Add/update tests for filtering and exclusion behavior.
4. Update consumer instructions if scope changes.