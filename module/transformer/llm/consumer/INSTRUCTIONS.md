# Transformer Instructions
How to build and apply AST transformers safely.

## Setup
1. Install @travetto/transformer.
2. Create transformer source using expected naming conventions.
3. Ensure transformer activation is explicit and opt-in.

## Usage Workflow
- Implement handlers for targeted node kinds.
- Register handlers via transformer utilities.
- Validate transformed output under full workspace compilation.

Minimal pattern:
1. Create transformer class.
2. Register before/after handlers.
3. Compile and inspect output for correctness/idempotency.

## Safe Defaults
- Keep transformations minimal and deterministic.
- Preserve source semantics unless explicitly intended.
- Test repeated compile scenarios in monorepo contexts.
