# Module LLM Index

Internal index of per-module LLM support files. These docs are committed to the repository and intended to remain outside module publish artifacts.

## Role Model

- Consumer docs: Usage-focused guidance for application developers using Travetto modules.
- Maintainer docs: Internal implementation guidance for contributors changing framework code.
- Consumer docs must include every public decorator exposed by the module, with purpose, usage guidance, and a minimal example.
- Consumer docs must include all non-internal utility classes/APIs exposed by the module, with practical usage guidance.

Each covered module should provide:

- `llm/consumer/OVERVIEW.md`
- `llm/consumer/INSTRUCTIONS.md`
- `llm/consumer/TIPS.md`
- `llm/maintainer/OVERVIEW.md`
- `llm/maintainer/INSTRUCTIONS.md`
- `llm/maintainer/TIPS.md`

## Wave 1: Core Framework

### runtime

- module/runtime/llm/consumer/OVERVIEW.md
- module/runtime/llm/consumer/INSTRUCTIONS.md
- module/runtime/llm/consumer/TIPS.md
- module/runtime/llm/maintainer/OVERVIEW.md
- module/runtime/llm/maintainer/INSTRUCTIONS.md
- module/runtime/llm/maintainer/TIPS.md

### config

- module/config/llm/consumer/OVERVIEW.md
- module/config/llm/consumer/INSTRUCTIONS.md
- module/config/llm/consumer/TIPS.md
- module/config/llm/maintainer/OVERVIEW.md
- module/config/llm/maintainer/INSTRUCTIONS.md
- module/config/llm/maintainer/TIPS.md

### schema

- module/schema/llm/consumer/OVERVIEW.md
- module/schema/llm/consumer/INSTRUCTIONS.md
- module/schema/llm/consumer/TIPS.md
- module/schema/llm/maintainer/OVERVIEW.md
- module/schema/llm/maintainer/INSTRUCTIONS.md
- module/schema/llm/maintainer/TIPS.md

### di

- module/di/llm/consumer/OVERVIEW.md
- module/di/llm/consumer/INSTRUCTIONS.md
- module/di/llm/consumer/TIPS.md
- module/di/llm/maintainer/OVERVIEW.md
- module/di/llm/maintainer/INSTRUCTIONS.md
- module/di/llm/maintainer/TIPS.md

### compiler

- module/compiler/llm/consumer/OVERVIEW.md
- module/compiler/llm/consumer/INSTRUCTIONS.md
- module/compiler/llm/consumer/TIPS.md
- module/compiler/llm/maintainer/OVERVIEW.md
- module/compiler/llm/maintainer/INSTRUCTIONS.md
- module/compiler/llm/maintainer/TIPS.md

### manifest

- module/manifest/llm/consumer/OVERVIEW.md
- module/manifest/llm/consumer/INSTRUCTIONS.md
- module/manifest/llm/consumer/TIPS.md
- module/manifest/llm/maintainer/OVERVIEW.md
- module/manifest/llm/maintainer/INSTRUCTIONS.md
- module/manifest/llm/maintainer/TIPS.md

## Wave 2: Application Surface

### cli

- module/cli/llm/consumer/OVERVIEW.md
- module/cli/llm/consumer/INSTRUCTIONS.md
- module/cli/llm/consumer/TIPS.md
- module/cli/llm/maintainer/OVERVIEW.md
- module/cli/llm/maintainer/INSTRUCTIONS.md
- module/cli/llm/maintainer/TIPS.md

### model

- module/model/llm/consumer/OVERVIEW.md
- module/model/llm/consumer/INSTRUCTIONS.md
- module/model/llm/consumer/TIPS.md
- module/model/llm/maintainer/OVERVIEW.md
- module/model/llm/maintainer/INSTRUCTIONS.md
- module/model/llm/maintainer/TIPS.md

### web

- module/web/llm/consumer/OVERVIEW.md
- module/web/llm/consumer/INSTRUCTIONS.md
- module/web/llm/consumer/TIPS.md
- module/web/llm/maintainer/OVERVIEW.md
- module/web/llm/maintainer/INSTRUCTIONS.md
- module/web/llm/maintainer/TIPS.md

### auth

- module/auth/llm/consumer/OVERVIEW.md
- module/auth/llm/consumer/INSTRUCTIONS.md
- module/auth/llm/consumer/TIPS.md
- module/auth/llm/maintainer/OVERVIEW.md
- module/auth/llm/maintainer/INSTRUCTIONS.md
- module/auth/llm/maintainer/TIPS.md

### cache

- module/cache/llm/consumer/OVERVIEW.md
- module/cache/llm/consumer/INSTRUCTIONS.md
- module/cache/llm/consumer/TIPS.md
- module/cache/llm/maintainer/OVERVIEW.md
- module/cache/llm/maintainer/INSTRUCTIONS.md
- module/cache/llm/maintainer/TIPS.md

### test

- module/test/llm/consumer/OVERVIEW.md
- module/test/llm/consumer/INSTRUCTIONS.md
- module/test/llm/consumer/TIPS.md
- module/test/llm/maintainer/OVERVIEW.md
- module/test/llm/maintainer/INSTRUCTIONS.md
- module/test/llm/maintainer/TIPS.md

## Wave 3: Platform and Tooling Support

### openapi

- module/openapi/llm/consumer/OVERVIEW.md
- module/openapi/llm/consumer/INSTRUCTIONS.md
- module/openapi/llm/consumer/TIPS.md
- module/openapi/llm/maintainer/OVERVIEW.md
- module/openapi/llm/maintainer/INSTRUCTIONS.md
- module/openapi/llm/maintainer/TIPS.md

### terminal

- module/terminal/llm/consumer/OVERVIEW.md
- module/terminal/llm/consumer/INSTRUCTIONS.md
- module/terminal/llm/consumer/TIPS.md
- module/terminal/llm/maintainer/OVERVIEW.md
- module/terminal/llm/maintainer/INSTRUCTIONS.md
- module/terminal/llm/maintainer/TIPS.md

### repo

- module/repo/llm/consumer/OVERVIEW.md
- module/repo/llm/consumer/INSTRUCTIONS.md
- module/repo/llm/consumer/TIPS.md
- module/repo/llm/maintainer/OVERVIEW.md
- module/repo/llm/maintainer/INSTRUCTIONS.md
- module/repo/llm/maintainer/TIPS.md

### registry

- module/registry/llm/consumer/OVERVIEW.md
- module/registry/llm/consumer/INSTRUCTIONS.md
- module/registry/llm/consumer/TIPS.md
- module/registry/llm/maintainer/OVERVIEW.md
- module/registry/llm/maintainer/INSTRUCTIONS.md
- module/registry/llm/maintainer/TIPS.md

### context

- module/context/llm/consumer/OVERVIEW.md
- module/context/llm/consumer/INSTRUCTIONS.md
- module/context/llm/consumer/TIPS.md
- module/context/llm/maintainer/OVERVIEW.md
- module/context/llm/maintainer/INSTRUCTIONS.md
- module/context/llm/maintainer/TIPS.md

### log

- module/log/llm/consumer/OVERVIEW.md
- module/log/llm/consumer/INSTRUCTIONS.md
- module/log/llm/consumer/TIPS.md
- module/log/llm/maintainer/OVERVIEW.md
- module/log/llm/maintainer/INSTRUCTIONS.md
- module/log/llm/maintainer/TIPS.md

## Wave 4: Model Extension Modules

### model-indexed

- module/model-indexed/llm/consumer/OVERVIEW.md
- module/model-indexed/llm/consumer/INSTRUCTIONS.md
- module/model-indexed/llm/consumer/TIPS.md
- module/model-indexed/llm/maintainer/OVERVIEW.md
- module/model-indexed/llm/maintainer/INSTRUCTIONS.md
- module/model-indexed/llm/maintainer/TIPS.md

### model-memory

- module/model-memory/llm/consumer/OVERVIEW.md
- module/model-memory/llm/consumer/INSTRUCTIONS.md
- module/model-memory/llm/consumer/TIPS.md
- module/model-memory/llm/maintainer/OVERVIEW.md
- module/model-memory/llm/maintainer/INSTRUCTIONS.md
- module/model-memory/llm/maintainer/TIPS.md

### model-query

- module/model-query/llm/consumer/OVERVIEW.md
- module/model-query/llm/consumer/INSTRUCTIONS.md
- module/model-query/llm/consumer/TIPS.md
- module/model-query/llm/maintainer/OVERVIEW.md
- module/model-query/llm/maintainer/INSTRUCTIONS.md
- module/model-query/llm/maintainer/TIPS.md

### model-query-language

- module/model-query-language/llm/consumer/OVERVIEW.md
- module/model-query-language/llm/consumer/INSTRUCTIONS.md
- module/model-query-language/llm/consumer/TIPS.md
- module/model-query-language/llm/maintainer/OVERVIEW.md
- module/model-query-language/llm/maintainer/INSTRUCTIONS.md
- module/model-query-language/llm/maintainer/TIPS.md

### model-sql

- module/model-sql/llm/consumer/OVERVIEW.md
- module/model-sql/llm/consumer/INSTRUCTIONS.md
- module/model-sql/llm/consumer/TIPS.md
- module/model-sql/llm/maintainer/OVERVIEW.md
- module/model-sql/llm/maintainer/INSTRUCTIONS.md
- module/model-sql/llm/maintainer/TIPS.md

### model-mongo

- module/model-mongo/llm/consumer/OVERVIEW.md
- module/model-mongo/llm/consumer/INSTRUCTIONS.md
- module/model-mongo/llm/consumer/TIPS.md
- module/model-mongo/llm/maintainer/OVERVIEW.md
- module/model-mongo/llm/maintainer/INSTRUCTIONS.md
- module/model-mongo/llm/maintainer/TIPS.md

## Next

- Add Wave 4 modules with both role folders and six total files per module.
- Integrate `npx trv cli:schema` into synthesis inputs for command/schema-aware agent support.
- After all modules are complete, create module/llm-support to synthesize cross-module instructions and workflows.

## Quality Hardening Plan

After wave coverage is complete for a module, run a targeted quality pass for both roles:

1. Consumer hardening
	- Ensure every public decorator is documented with purpose and practical usage guidance.
	- Ensure non-internal utility classes/APIs are described with actionable workflows.
	- Add "safe defaults" and common pitfalls that reduce LLM hallucination risk.
2. Maintainer hardening
	- Add compatibility and breaking-change guidance for behavior-sensitive APIs.
	- Add testing matrix expectations covering at least one downstream integration surface.
	- Add triage guidance for registration vs bind/coerce vs validate changes.
3. Cross-role consistency check
	- Ensure consumer and maintainer docs do not conflict on expected behavior.
	- Keep tone and structure consistent with module-level LLM docs.

### Current Hardening Status

- schema: in progress (consumer and maintainer instruction depth expanded; validate with follow-up consistency pass)
- model-indexed: initial coverage added; hardening pending
- model-memory: initial coverage added; hardening pending
- model-query: initial coverage added; hardening pending
- model-query-language: initial coverage added; hardening pending
- model-sql: initial coverage added; hardening pending
- model-mongo: initial coverage added; hardening pending
