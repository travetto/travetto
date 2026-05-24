# Web Aws Lambda Overview
The @travetto/web-aws-lambda module adapts Travetto web endpoints to AWS Lambda execution and packaging workflows.

## What This Module Is
This module provides runtime adapter entrypoints and packaging support to run web controllers as Lambda handlers.

## Why To Use It
- It enables serverless deployment for web APIs on AWS Lambda.
- It aligns web endpoint execution with Lambda event contracts.
- It supports CLI packaging workflows for deployable Lambda bundles.

## When To Use It
- Use when deploying Travetto web endpoints to AWS Lambda.
- Use when API runtime should be event-driven and serverless.
- Use when build/deploy requires Lambda-specific packaging integration.

## When Not To Use It
- Do not use for long-lived streaming response use cases unsupported by Lambda transport behavior.
- Do not assume container/server runtime semantics when targeting Lambda handlers.

## Core Capabilities
- Lambda entrypoint adapter for Travetto web pipelines.
- Event/request translation between AWS payloads and web request handling.
- CLI-friendly packaging entrypoint defaults for Lambda builds.

## Decorators
- This module does not expose consumer decorators.

## Utility Classes (Non-Internal)
- This module does not expose consumer utility classes under non-internal paths.

## Core APIs and Extension Points
- Lambda entry handler support (`support/entry.handler.ts` packaging default).
- Integration with `pack:lambda` workflow for deployment artifacts.
- Adapter behavior for request/response mapping.

Decision guideline:
Use this module when your deployment boundary is AWS Lambda and your API should remain implemented with standard Travetto web controllers.

## Typical Integration Flow
1. Build standard web controllers/services.
2. Configure Lambda packaging with `pack:lambda` options.
3. Deploy generated artifact to AWS Lambda.
4. Route API Gateway/Lambda events through adapter entrypoint.

## Practical Scenario
For an internal API moving from container hosting to Lambda, keep controller code unchanged, package with Lambda entry support, and deploy behind API Gateway.

Common pitfalls:
- Expecting streamed responses without considering Lambda buffering limits.
- Misconfiguring packaging entrypoint for generated artifact.
- Mixing environment assumptions between local server runs and Lambda runtime.
