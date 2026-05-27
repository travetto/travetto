## llm-support Roadmap

Scope: module/llm-support

Purpose: Capture remaining work and sequencing for llm-support.

### Near-Term Priorities
1. Contract Consolidation
- Completed: standardized bind+validate helper usage across runtime and tests.
- Completed: decided `schema.from(payload as Any)` is not mandatory in-module because no-type-assertion rules apply in runtime/tooling files.
- Completed: minimized test-local duplicate schemas by promoting reusable MCP result schemas to runtime exports and reusing them in tests.

2. MCP Contract Reuse
- Evaluate exporting additional typed schemas for common MCP `result` payloads.
- Keep JSON-RPC envelopes explicit and stable for external consumers.

3. Guidance Data Freshness
- Completed: operation metadata audit against current module capability, including executor linkage checks.
- Completed: added workflow guidance consistency guardrails (unique IDs, `cli:schema` command rule, non-empty recommended modules).
- Completed: added snippet metadata drift guardrails verifying all snippet `operationIds` map to valid operations.

4. Execution Coverage Expansion
- Completed: overwrite conflict path tests.
- Completed: monorepo path/name combination tests.
- Completed: negative-path tests for invalid payloads and tool failure behavior.

5. Documentation Alignment
- Add/refresh examples for tooling and MCP invocation payloads.
- Add contributor section describing class-first contract approach.
- Ensure docs reflect current command names and arguments.

### Medium-Term Enhancements
1. CI Validation
- Decide if snippet/doc metadata validation should run in CI.
- Add lightweight integrity checks if adopted.

2. Consumer Experience
- Evaluate whether to expose helper APIs for common LLM integration flows.
- Consider versioned compatibility notes for MCP consumers.

3. Planning/Execution Fidelity
- Improve plan-to-artifact traceability so each generated artifact maps clearly to an operation and step.

### Risks and Mitigations
1. Risk: Guidance drift from real CLI behavior.
- Mitigation: require `cli:schema` verification before changing command guidance.

2. Risk: Contract drift between runtime and tests.
- Mitigation: prefer shared schema classes and schema-based assertions.

3. Risk: Regression in generation safety.
- Mitigation: preserve dry-run default and expand conflict tests.

### Verification Checklist
1. `npx trv test module/llm-support/test/tooling.ts`
2. `npx trv test module/llm-support/test/mcp.ts`
3. `npx trv lint module/llm-support/src/**/*.ts module/llm-support/test/**/*.ts`

### Exit Criteria for Current Roadmap
1. Contract style is documented and uniformly applied.
2. MCP/tooling tests cover positive and key negative paths.
3. Guidance/snippet metadata passes freshness audit.
4. Docs show current API/CLI usage without stale examples.
