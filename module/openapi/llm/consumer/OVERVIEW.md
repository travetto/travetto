# OpenAPI Overview
The @travetto/openapi module generates OpenAPI specifications from Travetto Web and Schema metadata.

## What This Module Is
This module bridges internal endpoint/schema metadata into external OpenAPI documents (JSON/YAML) for API documentation and client generation.

## Why To Use It
- You want your API contracts to stay synchronized with controller and schema code.
- You need machine-readable API specs for client generation and partner integrations.
- You want automated docs output during development or CI workflows.

## When To Use It
- Use when building HTTP APIs with @travetto/web and @travetto/schema.
- Use when publishing API specs for frontend/mobile/client SDK teams.
- Use when automating spec generation through CLI workflows.

## When Not To Use It
- Do not use as the source of business validation rules; keep those in schema/web definitions.
- Do not hand-edit generated spec files as a long-term maintenance strategy.

## Core Capabilities
- OpenAPI 3.x generation from framework metadata.
- Runtime and CLI-based specification output.
- Configurable API info/host/spec output behavior.
- Optional persistence and watch-mode regeneration.

## Decorators
- No consumer decorators.

## Utility Classes (Non-Internal)
- This module does not expose consumer utility classes under non-internal paths.

## Core APIs and Extension Points
- OpenApiService for generating and serving specification output.
- OpenapiVisitor for metadata-to-spec traversal.
- ApiInfoConfig, ApiHostConfig, ApiSpecConfig for runtime configuration.

Decision guideline:
Use generated OpenAPI output as the canonical external contract artifact and keep source-of-truth behavior in web/schema code, not in post-processed spec edits.

## Typical Integration Flow
1. Build APIs with @travetto/web and schema models.
2. Configure api.info/api.host/api.spec values.
3. Generate output via runtime exposure or CLI (openapi:spec).
4. Feed generated spec into docs portals or client generators.

## Practical Scenario
When frontend and backend evolve in parallel, use generated OpenAPI output as the contract artifact so client codegen and endpoint implementation remain aligned.

Common pitfalls:
- Hand-editing generated specs and drifting from controller/schema behavior.
- Treating OpenAPI generation as a replacement for runtime validation.
- Changing metadata traversal behavior without compatibility checks for schema consumers.
