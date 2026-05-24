# Model Memory Instructions
How to use the in-memory model provider effectively.

## Setup
1. Define your entities with @travetto/model.
2. Install and configure @travetto/model-memory.
3. Treat the service as ephemeral storage and reset or namespace it appropriately for tests.

## Usage Workflow
- Use `MemoryModelService` as the backing provider for development and automated tests.
- Configure `namespace` when multiple logical stores should remain isolated in one process.
- Keep `cullRate` explicit when expiry behavior matters to a test or demo.
- Use the same service for blob, expiry, and indexed behavior when you want one all-in-one local provider.

Minimal pattern:
1. Assign a unique namespace per test suite or fixture scope.
2. Initialize and tear down storage explicitly in test setup/teardown hooks.
3. Run a subset of the same tests against one non-memory provider before release.

## Safe Defaults
- Assume all data disappears when the process exits.
- Keep test state isolated instead of sharing one global memory store across unrelated suites.
- Do not treat in-memory ordering or timing behavior as proof of production datastore behavior.
- Avoid using memory-provider internals (such as direct map inspection) in tests that should stay provider-agnostic.