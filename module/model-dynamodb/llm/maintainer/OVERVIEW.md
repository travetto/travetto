# Model Dynamodb Maintainer Overview
Maintainer guidance for DynamoDB provider behavior and index lifecycle management.

## Ownership
- DynamoDB CRUD/storage/expiry/indexed provider implementation.
- Table/GSI lifecycle and index-attribute mutation behavior.
- DynamoDB utility logic for index naming, diffing, and value conversion.

## High-Signal Entry Points
- src/service.ts
- src/util.ts
- src/config.ts
- README.md
- support/

## Integration Boundaries
- Depends on @travetto/model and @travetto/model-indexed contracts.
- Uses DynamoDB table/query/GSI behaviors through AWS SDK.
- Integrates with runtime/di lifecycle and model metadata registry.

Compatibility boundaries:
- Table naming, namespace behavior, and index-name derivation are compatibility boundaries and semver-sensitive.
- Indexed query translation and write-path attribute mutation behavior is contract-visible.

## Invariants
- Indexed attribute updates on writes must stay synchronized with index definitions.
- Table and GSI reconciliation logic must remain safe and idempotent.
- Expiry handling must continue to hide expired records during reads.
- Namespace/table naming must remain deterministic.

## Extension Points
- `DynamoDBModelConfig` can be extended additively for client behavior.
- `DynamoDBUtil` can evolve with additive helper behavior.
- Service replacement/wrapping can be done through DI while preserving contracts.

## Testing Expectations
- Run module tests for CRUD/indexed/storage/expiry behavior.
- Validate index creation/update/delete diff logic against realistic table states.
- Recheck paging and suggest behavior when query construction changes.

Change-triage guidance:
- Utility/index-name changes: run upsertModel and index-diff reconciliation tests together.
- Write-path changes: validate indexed attribute mutation and retrieval compatibility.
- Config changes: test local endpoint, namespace overrides, and explicit credential behavior.

## Risk Areas
- GSI evolution and table update flows can break production reads if changed carelessly.
- Index attribute mismatch can cause silent lookup failures.
- Expiry and not-found behavior can regress under partial update changes.