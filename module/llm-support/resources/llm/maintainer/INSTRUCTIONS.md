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
- Compiler State Verification Rule: Use `npx trvc info` to check compiler server status. Active compiler servers return a JSON object with a `state` field (such as `'watch-start'`, `'compile-end'`, `'init'`, `'compile-failed'`). If `state` is `'compile-failed'`, build errors occurred and error details are available in the `messages.error` field of the info payload (which preserves scoped messages keyed by scope, such as `error` and `reset`). The compiler runs as an independent background daemon; `npx trvc start` ensures it is running, `npx trvc restart` restarts it, and `npx trvc stop` stops it. Local CLI commands (`trv <cmd>`) automatically start the watch daemon if it is not already running. Executing `npx trvc clean` is allowed and clears caches and restarts the compiler. Inactive servers return empty output.
- Compiler Reset and Watch Communication Rule: Rely on compiler logs (not compiler state payloads) to convey reset reasons and requirement details. The watch operation and CLI should stream live compiler logs (`WatchUtil.watchCompilerLogs()`) rather than emitting custom restart/reset log messages. `WatchUtil.watchCompilerLogs()` connects directly without waiting for `'watch-start'` and flushes pre-existing scoped messages (`reset`, `error`). In watch CLI operations, `SIGINT`/`SIGTERM` handlers must initiate full process shutdown via `ShutdownManager.shutdown({ mode: 'exit', reason: 'quit' })` to abort ongoing pause/wait signals cleanly.
- VS Code TypeScript Language Server Restart Rule: In the VS Code plugin, triggering the Travetto "Restart Compiler" command (`travetto.compiler.trvc:restart`) awaits compiler restart completion and then restarts the TypeScript language server (`typescript.restartTsServer`) to ensure TypeScript diagnostics, types, and IntelliSense synchronize with freshly compiled files.

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
- **Override Keyword**: Do not use TypeScript's `override` keyword on class methods or properties.
- **Inline SQL Formatting**: Format inline SQL queries using standard practices: one line per main section (`SELECT`, `FROM`, `WHERE`, `GROUP BY`, `ORDER BY`, etc.). For optional query clauses (such as limit, offset, or sort), place each optional clause on its own line using an inlined conditional expression (e.g. `FROM <table>\n${limit !== undefined ? `LIMIT ${limit}` : ''}` where `\n` is an actual newline in the template literal), rather than creating intermediate variables or placing optional tokens immediately adjacent to each other on a single line.
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
  - In SQL backends supporting multi-table drops (such as MySQL via `DROP TABLE IF EXISTS table1, table2, ...`), `deleteStorage` should execute all table drops in a single statement via `dropTables` / `getDropTablesSQL` to avoid performance bottlenecks from sequential roundtrips.
  - Multi-statement SQL queries: in SQLite, when executing multiple SQL statements as a batch (e.g. joined by `;\n`), always prepend the query with an explicit `-- exec\n` marker to trigger `client.exec()`. Never infer execution mode by checking for semicolons in the query string, which causes single statements (like schema introspection queries) containing semicolons or line breaks to mistakenly execute in exec mode without returning records.
  - Truncate operations (`truncateModel`, `truncateBlob`) must never swallow not-found errors; only delete operations (`deleteModel`, `deleteStorage`) may swallow not-found errors.
  - Keep `deleteModel` (structure/DDL destruction) and `truncateModel` (record/data purge) as distinct responsibilities; `truncateModel` must purge records without dropping or altering the underlying schema, table, or storage container. In SQL (and structured datastores), truncating a non-existent table must throw an error.
  - Runtime services (such as `CacheService.purge()`) that clear data must invoke `truncateModel`, never `deleteModel`.
- **Code Maintenance & Intentional Deletions**:
  - Never restore or re-add code that was removed unless explicitly requested or approved by the user.
  - Never modify or touch files in the `archived/` directory; it is preserved for historical reasons only.
- **PR Scope & Minimal Churn**:
  - Do not touch, reformat, or rename existing code (including expanding abbreviated identifiers or variables) when it is not material to the PR. Keep changes tightly focused on the requested functionality or bug fix.
  - Do not make cosmetic changes, stylistic rearrangements, or guard rewrites that provide no functional or behavioral benefit.
- **Code Style & Safety**:
  - Prefer declarative object definitions with inline conditional spreading (`...(condition ? { ... } : {})`) over creating mutable objects and appending properties via `if` statements.
  - Use optional chaining (`?.`) instead of non-null assertions (`!`) on schema and registry lookups (e.g., `SchemaRegistryIndex.getNestedFieldConfig(...)`).
  - Avoid redundant `String(...)` conversions inside template literals (e.g., use `` `$${field}` `` instead of `` `$${String(field)}` ``).
  - Avoid inline `.catch` invocations on promises unless strictly necessary (e.g., an unawaited promise). Prefer standard `try / catch` blocks instead.
  - Avoid creating redundant type aliases or duplicate types (e.g., introducing a short alias alongside a canonical descriptive type). Expose a single canonical descriptive type name.
- **Test Skipping**:
  - Use `@SkipIf(predicate)` and `@SkipUnless(predicate)` decorators from `@travetto/test` on test methods or suites to conditionally skip execution.
  - Skip predicates must be functions that receive the suite instance: `(instance: T) => boolean | Promise<boolean>`. Static boolean values are not supported.

## Catalog Evolution
When adding operations:
1. Add type-safe operation metadata.
2. Add workflow/install entries if module dependencies change.
3. Add/update tests for filtering and exclusion behavior.
4. Update consumer instructions if scope changes.