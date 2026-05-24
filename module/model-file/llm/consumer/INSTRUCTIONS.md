# Model File Instructions
How to use the file-system-backed model provider safely.

## Setup
1. Install @travetto/model-file.
2. Configure `model.file` folder and namespace.
3. Resolve `FileModelService` through DI.

## Usage Workflow
- Use CRUD methods for core model data and blob methods for binary content.
- Keep namespace configuration explicit to isolate environments.
- Use expiry deletion flows when models define expiry semantics.
- Use truncate/delete storage methods carefully in test and maintenance workflows.

Minimal pattern:
1. Keep file provider config and DI wiring in one startup location.
2. Route model and blob calls through repository-style adapters.
3. Add integration checks for namespace isolation and blob metadata consistency.

## Safe Defaults
- Keep provider folder locations outside transient or sensitive directories.
- Do not depend on database-like concurrency guarantees.
- Bound list operations and keep cleanup flows explicit.
- Keep cleanup and truncate operations gated behind explicit maintenance workflows.