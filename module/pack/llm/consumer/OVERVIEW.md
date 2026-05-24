# Pack Overview
The @travetto/pack module provides build-time packaging commands for deployable application artifacts.

## What This Module Is
This module offers CLI workflows that bundle Travetto apps into runnable folders, zip archives, or docker images.

## Why To Use It
- It standardizes production packaging outputs.
- It encapsulates rollup-based bundling for framework runtime expectations.
- It supports deployment-target workflows (zip/docker) with consistent flags.

## When To Use It
- Use when preparing deployable artifacts from Travetto applications.
- Use when CI/CD pipelines need deterministic bundle steps.
- Use when producing docker-ready outputs with framework entrypoint semantics.

## When Not To Use It
- Do not use pack outputs as a substitute for local dev workflows.
- Do not treat ejected scripts as static if pack config changes frequently.

## Core Capabilities
- `pack` for directory output bundles.
- `pack:zip` for zipped artifacts.
- `pack:docker` for Dockerfile/container build flows.

## Decorators
- This module does not expose consumer decorators.

## Utility Classes (Non-Internal)
- This module is primarily CLI-driven; non-internal utility classes are not the primary public entrypoint.

## Core APIs and Extension Points
- Pack CLI command options for entrypoint/output/manifest/resource behavior.
- Eject-file support for scriptable build steps.
- Docker packaging configuration extension points.

Decision guideline:
Use @travetto/pack whenever deployment artifacts should be reproducible from CLI-driven framework-native packaging pipelines.

## Typical Integration Flow
1. Choose target (`pack`, `pack:zip`, or `pack:docker`).
2. Configure entrypoint/output/manifest options.
3. Run command in CI or release pipeline.
4. Validate produced artifact in target runtime.

## Practical Scenario
For a service deploy pipeline, run `trv pack:docker` with explicit base image, tags, and runtime user, then publish image and deploy through your orchestrator.

Common pitfalls:
- Forgetting entrypoint/runtime assumptions when switching targets.
- Relying on local environment state instead of explicit CLI options.
- Not validating generated artifacts after pack configuration changes.
