# Runtime Instructions
Follow these steps to manage your application execution.

## Setup
1. Ensure @travetto/runtime is installed.
2. Import Runtime/Env/ShutdownManager from @travetto/runtime where needed.

## Usage Workflow
- Register cleanup handlers via ShutdownManager.signal.addEventListener('abort', handler).
- Access environment and mode information via Env and Runtime.
- Resolve module and workspace paths via Runtime.workspaceRelative and Runtime.modulePath.

Minimal pattern:
1. Read startup/runtime flags through Env/EnvProp.
2. Resolve local module resources through Runtime path helpers.
3. Register idempotent cleanup handlers with ShutdownManager.

## Safe Defaults
- Avoid calling process.exit directly when graceful cleanup is required.
- Prefer ShutdownManager.shutdown() when you need controlled termination behavior.
- Prefer Runtime and Env abstractions over raw process/env/path handling.
- Keep shutdown handlers idempotent and tolerant of partial cleanup failures.
