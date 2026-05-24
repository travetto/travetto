# Pack Instructions
How to package Travetto applications for deployment.

## Setup
1. Install @travetto/pack.
2. Confirm application entrypoint and module context.
3. Choose output target: folder, zip, or docker.

## Usage Workflow
- Use `trv pack` for runnable build output directories.
- Use `trv pack:zip` for archive artifacts.
- Use `trv pack:docker` for image build/push workflows.

Minimal pattern:
1. Set output/entry options.
2. Run selected pack command.
3. Smoke-test artifact in target environment.

## Safe Defaults
- Keep output paths and entrypoints explicit.
- Keep build scripts deterministic via CLI flags.
- Validate manifest/resources are present in produced artifacts.
