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

## Next

- Add Wave 3 modules with both role folders and six total files per module.
- Integrate `npx trv cli:schema` into synthesis inputs for command/schema-aware agent support.
- After all modules are complete, create module/llm-support to synthesize cross-module instructions and workflows.
