# OpenAPI Instructions
How to use generated OpenAPI specs effectively.

## Setup
1. Install and enable @travetto/openapi alongside @travetto/web and @travetto/schema.
2. Configure `api.info`, `api.host`, and `api.spec` settings for your environment.
3. Choose runtime serving, CLI generation, or both as your delivery mechanism.

## Usage Workflow
- Keep endpoint and schema metadata accurate in source code first.
- Generate specs via runtime exposure or CLI (`openapi:spec`) as part of CI/deploy workflows.
- Publish generated artifacts to docs portals or SDK generation pipelines.
- Validate generated output whenever route or schema metadata changes.

Minimal pattern:
1. Define/maintain typed endpoints and schemas.
2. Generate spec from source metadata.
3. Diff and publish artifact through automated pipeline.

## Safe Defaults
- Treat generated spec files as build artifacts, not hand-maintained source.
- Keep API info/host config explicit per environment.
- Fail CI on generation regressions that break downstream tooling.
