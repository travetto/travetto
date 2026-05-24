# Web Rpc Instructions
How to generate and use RPC clients safely.

## Setup
1. Install @travetto/web-rpc.
2. Configure rpc client generation target/output via config or CLI args.
3. Ensure server controllers and generated types are in sync.

## Usage Workflow
- Generate clients with `trv web:rpc-client`.
- Build typed client factory from generated artifacts.
- Use proxy client methods instead of handwritten request wrappers.

Minimal pattern:
1. Configure generation output.
2. Run client generation.
3. Import factory and invoke typed controller methods.

## Safe Defaults
- Regenerate clients whenever controller signatures change.
- Keep generated output directory controlled and reproducible.
- Validate runtime URL/base config separately from generated type contracts.
