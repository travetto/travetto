# LLM Support Instructions
Task-oriented guidance and operations for generating Travetto projects and features.

## Core Intent
Use this module to discover and execute generation-ready guidance for:
- project bootstrap and model backend selection
- web/controller/service and interceptor creation
- auth, uploads, model-indexed/model-query flows
- lint/test quality enablement
- email generation and delivery sub-operations

## Scope Decisions
Do not recommend excluded operations unless explicitly requested:
- log:config
- log:instrumentation
- eslint:profile
- test:mock-service

## Usage Workflow
1. Discover command shapes with `npx trv cli:schema` when uncertain.
2. Request recommendations with `npx trv llm:support:recommend`.
3. Select bundles/workflows/operations and generate plan-first changes.
4. Validate with lint/test and targeted compile checks.