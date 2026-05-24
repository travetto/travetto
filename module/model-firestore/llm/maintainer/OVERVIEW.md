# Model Firestore Maintainer Overview
Maintainer guidance for Firestore provider behavior and indexed contract integration.

## Ownership
- Firestore CRUD/storage provider implementation.
- Firestore config parsing/finalization and emulator/credential behavior.
- Integration with model-indexed contract methods.

## High-Signal Entry Points
- src/service.ts
- src/config.ts
- README.md
- support/

## Integration Boundaries
- Depends on @travetto/model and @travetto/model-indexed contracts.
- Uses Firestore client APIs for persistence and indexed query construction.
- Integrates with runtime/config/di lifecycle behavior.

## Invariants
- Collection naming with namespace must remain stable and deterministic.
- Indexed key/sort translation to Firestore query constraints must stay consistent.
- CRUD id semantics and post-load handling must align with model contract behavior.
- Config finalization must preserve explicit config while applying local-dev defaults safely.

## Extension Points
- Service can be wrapped/replaced through DI while preserving contracts.
- Config can be extended additively for new Firestore options.
- Indexed behavior can evolve as long as contract-level semantics remain compatible.

## Testing Expectations
- Run module tests for CRUD and indexed behaviors.
- Validate emulator and credential file initialization paths.
- Re-test paging/suggest/indexed lookup behavior when query construction changes.

## Risk Areas
- Firestore query constraints and index requirements can surface runtime failures if query construction drifts.
- Config finalization changes can break local emulator workflows.
- ID and null/missing-value handling in indexed flows are regression-prone.