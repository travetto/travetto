# LLM Support Overview

## What This Module Is
The @travetto/llm-support module is a synthesis layer for LLM-facing framework guidance. It consolidates module-level consumer and maintainer docs into task-oriented workflows so assistants can guide users through package selection, setup sequencing, and cross-module decisions.

## Why To Use It
- It provides a single decision surface for package recommendations instead of forcing tool calls to inspect many module docs during every prompt.
- It reduces incorrect install suggestions by coupling task bundles with explicit prerequisite chains.
- It standardizes command-discovery behavior by requiring CLI schema validation when command signatures are uncertain.

## When To Use It
- Use when an LLM needs to answer "what should I install for X?" across multiple modules.
- Use when planning end-to-end workflows that span runtime, web, model, auth, and worker modules.
- Use when command argument guidance depends on current command schema output.

## When Not To Use It
- Do not use as a replacement for package README files when deep module internals are needed.
- Do not infer adapter compatibility without checking module-level docs and package dependencies.
- Do not treat static guidance as authoritative when CLI signatures have changed and schema output has not been checked.

## Core Capabilities
- Task-bundle package guidance for common intents.
- Dependency-graph package guidance that distinguishes required versus optional adapters.
- Cross-module workflow synthesis for common framework outcomes.
- Needs-based non-SQL adapter selection for blob/query/indexed/expiry requirements.
- Provider-specific auth workflow guidance for Google OAuth via auth-web-passport.
- Scaffold-aligned workflow guidance for web+openapi, basic auth+session, web+model CRUD, backend selection, and quality setup.
- Command-discovery guardrails grounded in npx trv cli:schema.
- Packaged consumer-docs bundle generated at pack time for downstream tooling.
- CLI recommendation surface via trv llm:support:recommend for direct agent/tool integration.

## Decorators

- This module does not expose consumer decorators.

## Utility Classes (Non-Internal)

- INSTALL_BUNDLES: curated package sets by intent with required and optional distinctions.
- DEPENDENCY_GRAPH: prerequisite chain guidance for module recommendations.
- WORKFLOWS: task-oriented module guidance with verification checkpoints and command-discovery rules.

## Core APIs and Extension Points
- src/install-guidance.ts: task bundles and dependency graph constants.
- src/workflow-guidance.ts: workflow definitions and schema-check guidance.
- src/consumer-docs.ts: generated bundle of all consumer LLM docs.
- src/types.ts: guidance contracts for ingestion and downstream processing.
- support/cli.llm_support_recommend.ts: CLI command that resolves workflows and bundles into required/optional package recommendations.

Decision guideline:
Start with task bundles when users state an outcome (for example, "build an auth API"), then refine with dependency graph constraints to avoid over-installation.

## Typical Integration Flow
1. Identify user intent and map to a workflow in WORKFLOWS.
2. Resolve initial package set from INSTALL_BUNDLES.
3. Validate prerequisites and adapter options with DEPENDENCY_GRAPH.
4. If commands are involved, verify argument shape with npx trv cli:schema before final recommendations.
5. Use the packaged consumer-docs bundle when you need to route into module-level guidance.
6. Link the user to module-level docs for deep API specifics.

## Practical Scenario
For a request like "build a web API with auth and persistence," select the web baseline and auth-enabled bundles, then add the model persistence bundle. Use dependency graph checks to ensure @travetto/model prerequisites are satisfied, choose one adapter family (SQL or non-SQL), and then select one primary adapter package. If the user asks for install or setup command invocations, verify command signatures via npx trv cli:schema before returning command examples.
