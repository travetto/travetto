# Test Maintainer Overview
Maintainer guidance for @travetto/test suite registration, execution, and result modeling.

## Ownership
- Suite/test decorator metadata semantics.
- Lifecycle hook ordering and execution guarantees.
- Result/status models and reporting structure.

## High-Signal Entry Points
- src/decorator/suite.ts
- src/decorator/test.ts
- src/model/suite.ts
- src/model/test.ts
- src/model/util.ts
- src/registry/ (suite/test registration)

## Integration Boundaries
- Tight coupling with compiler/assert tooling for enhanced diagnostics.
- Output formats consumed by CI integrations and tooling.
