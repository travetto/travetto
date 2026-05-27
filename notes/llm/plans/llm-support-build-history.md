## llm-support Build History

Scope: module/llm-support

Purpose: Capture what was implemented, key architectural decisions, and verification evidence.

### Build Phases Completed
1. Tooling Surface
- Added LLM-callable tools for recommend/plan/execute.
- Added tool definitions with input schema metadata.

2. Recommendation and Planning
- Implemented operation catalog, category filtering, and excluded-operation handling.
- Implemented install bundle and workflow guidance recommendation.
- Implemented snippet catalog loading and filtering by operation/tag.
- Implemented plan generation with step rationale and file targets.

3. Execution Engine
- Implemented `execute` boundary with dry-run default.
- Added `apply` mode to write artifacts.
- Added overwrite handling for pre-existing files.
- Added bootstrap generation including package files.
- Added monorepo support (`monorepo`, `workspacePath`, `workspaceName`).

4. MCP Adapter and CLI Exposure
- Implemented JSON-RPC handling for:
  - `initialize`
  - `notifications/initialized`
  - `tools/list`
  - `tools/call`
- Exposed stdio command surface as `llm:support:mcp`.

5. Contract Hardening
- Migrated boundary contracts to schema-first classes.
- Replaced interface duplication with class-derived type aliases.
- Added runtime output validation at tooling boundaries.
- Moved MCP request/response contracts to schema classes.

6. Test Hardening
- Migrated tooling tests to schema bind+validate.
- Migrated MCP tests away from custom shape guards to schema validation.
- Updated helper style to `schema.from(payload as Any)` where applied.
- Removed unnecessary `@Required(false)` decorators on optional schema fields.
- Added execution coverage for overwrite conflict behavior.
- Added execution coverage for monorepo workspace path/name bootstrap permutations.
- Added negative-path execute validation test in tooling boundary tests.
- Added MCP tool failure-shaping test for JSON-RPC error mapping (`-32000`).
- Standardized runtime/tooling bind+validate helpers on non-assertion-safe binding (`schema.from({})` + guarded assign) to satisfy no-type-assertion rules while preserving behavior.
- Promoted reusable MCP result schemas into runtime exports and removed duplicate MCP result schema definitions from tests.

### Notable Design Decisions
1. Schema classes are the source of truth for boundary contracts.
2. Type aliases are derived from classes instead of parallel interface trees.
3. Prefer `type[]` style over `Array<type>`.
4. Avoid `Reflect` and avoid test/runtime contract drift.
5. Keep dry-run default for generation safety.

### Verification Evidence
1. Tests
- `npx trv test module/llm-support/test/tooling.ts` passing.
- `npx trv test module/llm-support/test/mcp.ts` passing.

2. Compilation/Lint
- No outstanding diagnostics in updated llm-support contract/tooling/MCP files during recent refactors.

### Files Most Impacted
1. `module/llm-support/src/types.ts`
2. `module/llm-support/src/tooling.ts`
3. `module/llm-support/src/mcp.ts`
4. `module/llm-support/src/execute.ts`
5. `module/llm-support/test/tooling.ts`
6. `module/llm-support/test/mcp.ts`
7. `module/llm-support/support/cli.llm_support_mcp.ts`

### Maintenance
1. Append new milestones here when behavior or boundaries materially change.
2. Keep command/test evidence updated for major refactors.
