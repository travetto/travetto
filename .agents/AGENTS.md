# Coding Guidelines

This repository maintains its coding standards and agent instructions in the canonical documents below. Agents operating within this monorepo must review and follow the relevant guidance:

- **Framework Maintainer Instructions** (for developing, modifying, or testing framework modules within this monorepo):
  [`module/llm-support/resources/llm/maintainer/INSTRUCTIONS.md`](file:///Users/arcsine/Code/travetto/module/llm-support/resources/llm/maintainer/INSTRUCTIONS.md)

- **Application Consumer Instructions** (for consumer application workflows, generators, and end-user project usage):
  [`module/llm-support/resources/llm/consumer/INSTRUCTIONS.md`](file:///Users/arcsine/Code/travetto/module/llm-support/resources/llm/consumer/INSTRUCTIONS.md)

## Instruction Update Policy
Treat the instruction files as high-signal, cross-cutting standards—not a changelog or module specification log.

- **When to Update**: Only update `INSTRUCTIONS.md` when:
  1. The user **explicitly asks** to record or update a rule in the instructions, OR
  2. The user corrects a **broad, cross-cutting coding convention, style preference, or CLI workflow** that applies across multiple modules and cannot be inferred from types or linter rules. (If unsure whether feedback is a one-off task adjustment or a permanent repo rule, ask the user before editing `INSTRUCTIONS.md`).
- **What NOT to Add**: Never add PR-specific design decisions, module-internal API contracts, helper method signatures (e.g., `ModelCrudUtil`, `WatchUtil`, `IpcLogger`), or provider-specific implementation details. Those belong in code, JSDoc, or tests.
- **How to Write Entries**: Keep rules to 1–2 concise sentences, update existing bullets in-place rather than appending duplicates, and only update `consumer/INSTRUCTIONS.md` when the rule directly affects end-user application code.
