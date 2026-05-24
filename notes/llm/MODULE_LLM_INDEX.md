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

## Wave 4.5: Auth Extension Modules

### auth-model

- module/auth-model/llm/consumer/OVERVIEW.md
- module/auth-model/llm/consumer/INSTRUCTIONS.md
- module/auth-model/llm/consumer/TIPS.md
- module/auth-model/llm/maintainer/OVERVIEW.md
- module/auth-model/llm/maintainer/INSTRUCTIONS.md
- module/auth-model/llm/maintainer/TIPS.md

### auth-session

- module/auth-session/llm/consumer/OVERVIEW.md
- module/auth-session/llm/consumer/INSTRUCTIONS.md
- module/auth-session/llm/consumer/TIPS.md
- module/auth-session/llm/maintainer/OVERVIEW.md
- module/auth-session/llm/maintainer/INSTRUCTIONS.md
- module/auth-session/llm/maintainer/TIPS.md

### auth-web

- module/auth-web/llm/consumer/OVERVIEW.md
- module/auth-web/llm/consumer/INSTRUCTIONS.md
- module/auth-web/llm/consumer/TIPS.md
- module/auth-web/llm/maintainer/OVERVIEW.md
- module/auth-web/llm/maintainer/INSTRUCTIONS.md
- module/auth-web/llm/maintainer/TIPS.md

### auth-web-passport

- module/auth-web-passport/llm/consumer/OVERVIEW.md
- module/auth-web-passport/llm/consumer/INSTRUCTIONS.md
- module/auth-web-passport/llm/consumer/TIPS.md
- module/auth-web-passport/llm/maintainer/OVERVIEW.md
- module/auth-web-passport/llm/maintainer/INSTRUCTIONS.md
- module/auth-web-passport/llm/maintainer/TIPS.md

### auth-web-session

- module/auth-web-session/llm/consumer/OVERVIEW.md
- module/auth-web-session/llm/consumer/INSTRUCTIONS.md
- module/auth-web-session/llm/consumer/TIPS.md
- module/auth-web-session/llm/maintainer/OVERVIEW.md
- module/auth-web-session/llm/maintainer/INSTRUCTIONS.md
- module/auth-web-session/llm/maintainer/TIPS.md

### email

- module/email/llm/consumer/OVERVIEW.md
- module/email/llm/consumer/INSTRUCTIONS.md
- module/email/llm/consumer/TIPS.md
- module/email/llm/maintainer/OVERVIEW.md
- module/email/llm/maintainer/INSTRUCTIONS.md
- module/email/llm/maintainer/TIPS.md

### image

- module/image/llm/consumer/OVERVIEW.md
- module/image/llm/consumer/INSTRUCTIONS.md
- module/image/llm/consumer/TIPS.md
- module/image/llm/maintainer/OVERVIEW.md
- module/image/llm/maintainer/INSTRUCTIONS.md
- module/image/llm/maintainer/TIPS.md

### eslint

- module/eslint/llm/consumer/OVERVIEW.md
- module/eslint/llm/consumer/INSTRUCTIONS.md
- module/eslint/llm/consumer/TIPS.md
- module/eslint/llm/maintainer/OVERVIEW.md
- module/eslint/llm/maintainer/INSTRUCTIONS.md
- module/eslint/llm/maintainer/TIPS.md

### email-compiler

- module/email-compiler/llm/consumer/OVERVIEW.md
- module/email-compiler/llm/consumer/INSTRUCTIONS.md
- module/email-compiler/llm/consumer/TIPS.md
- module/email-compiler/llm/maintainer/OVERVIEW.md
- module/email-compiler/llm/maintainer/INSTRUCTIONS.md
- module/email-compiler/llm/maintainer/TIPS.md

### email-inky

- module/email-inky/llm/consumer/OVERVIEW.md
- module/email-inky/llm/consumer/INSTRUCTIONS.md
- module/email-inky/llm/consumer/TIPS.md
- module/email-inky/llm/maintainer/OVERVIEW.md
- module/email-inky/llm/maintainer/INSTRUCTIONS.md
- module/email-inky/llm/maintainer/TIPS.md

### email-nodemailer

- module/email-nodemailer/llm/consumer/OVERVIEW.md
- module/email-nodemailer/llm/consumer/INSTRUCTIONS.md
- module/email-nodemailer/llm/consumer/TIPS.md
- module/email-nodemailer/llm/maintainer/OVERVIEW.md
- module/email-nodemailer/llm/maintainer/INSTRUCTIONS.md
- module/email-nodemailer/llm/maintainer/TIPS.md

### web-http

- module/web-http/llm/consumer/OVERVIEW.md
- module/web-http/llm/consumer/INSTRUCTIONS.md
- module/web-http/llm/consumer/TIPS.md
- module/web-http/llm/maintainer/OVERVIEW.md
- module/web-http/llm/maintainer/INSTRUCTIONS.md
- module/web-http/llm/maintainer/TIPS.md

### web-connect

- module/web-connect/llm/consumer/OVERVIEW.md
- module/web-connect/llm/consumer/INSTRUCTIONS.md
- module/web-connect/llm/consumer/TIPS.md
- module/web-connect/llm/maintainer/OVERVIEW.md
- module/web-connect/llm/maintainer/INSTRUCTIONS.md
- module/web-connect/llm/maintainer/TIPS.md

### web-rpc

- module/web-rpc/llm/consumer/OVERVIEW.md
- module/web-rpc/llm/consumer/INSTRUCTIONS.md
- module/web-rpc/llm/consumer/TIPS.md
- module/web-rpc/llm/maintainer/OVERVIEW.md
- module/web-rpc/llm/maintainer/INSTRUCTIONS.md
- module/web-rpc/llm/maintainer/TIPS.md

### web-upload

- module/web-upload/llm/consumer/OVERVIEW.md
- module/web-upload/llm/consumer/INSTRUCTIONS.md
- module/web-upload/llm/consumer/TIPS.md
- module/web-upload/llm/maintainer/OVERVIEW.md
- module/web-upload/llm/maintainer/INSTRUCTIONS.md
- module/web-upload/llm/maintainer/TIPS.md

### web-aws-lambda

- module/web-aws-lambda/llm/consumer/OVERVIEW.md
- module/web-aws-lambda/llm/consumer/INSTRUCTIONS.md
- module/web-aws-lambda/llm/consumer/TIPS.md
- module/web-aws-lambda/llm/maintainer/OVERVIEW.md
- module/web-aws-lambda/llm/maintainer/INSTRUCTIONS.md
- module/web-aws-lambda/llm/maintainer/TIPS.md

### worker

- module/worker/llm/consumer/OVERVIEW.md
- module/worker/llm/consumer/INSTRUCTIONS.md
- module/worker/llm/consumer/TIPS.md
- module/worker/llm/maintainer/OVERVIEW.md
- module/worker/llm/maintainer/INSTRUCTIONS.md
- module/worker/llm/maintainer/TIPS.md

### doc

- module/doc/llm/consumer/OVERVIEW.md
- module/doc/llm/consumer/INSTRUCTIONS.md
- module/doc/llm/consumer/TIPS.md
- module/doc/llm/maintainer/OVERVIEW.md
- module/doc/llm/maintainer/INSTRUCTIONS.md
- module/doc/llm/maintainer/TIPS.md

### pack

- module/pack/llm/consumer/OVERVIEW.md
- module/pack/llm/consumer/INSTRUCTIONS.md
- module/pack/llm/consumer/TIPS.md
- module/pack/llm/maintainer/OVERVIEW.md
- module/pack/llm/maintainer/INSTRUCTIONS.md
- module/pack/llm/maintainer/TIPS.md

### scaffold

- module/scaffold/llm/consumer/OVERVIEW.md
- module/scaffold/llm/consumer/INSTRUCTIONS.md
- module/scaffold/llm/consumer/TIPS.md
- module/scaffold/llm/maintainer/OVERVIEW.md
- module/scaffold/llm/maintainer/INSTRUCTIONS.md
- module/scaffold/llm/maintainer/TIPS.md

### schema-faker

- module/schema-faker/llm/consumer/OVERVIEW.md
- module/schema-faker/llm/consumer/INSTRUCTIONS.md
- module/schema-faker/llm/consumer/TIPS.md
- module/schema-faker/llm/maintainer/OVERVIEW.md
- module/schema-faker/llm/maintainer/INSTRUCTIONS.md
- module/schema-faker/llm/maintainer/TIPS.md

### transformer

- module/transformer/llm/consumer/OVERVIEW.md
- module/transformer/llm/consumer/INSTRUCTIONS.md
- module/transformer/llm/consumer/TIPS.md
- module/transformer/llm/maintainer/OVERVIEW.md
- module/transformer/llm/maintainer/INSTRUCTIONS.md
- module/transformer/llm/maintainer/TIPS.md

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

### model-elasticsearch

- module/model-elasticsearch/llm/consumer/OVERVIEW.md
- module/model-elasticsearch/llm/consumer/INSTRUCTIONS.md
- module/model-elasticsearch/llm/consumer/TIPS.md
- module/model-elasticsearch/llm/maintainer/OVERVIEW.md
- module/model-elasticsearch/llm/maintainer/INSTRUCTIONS.md
- module/model-elasticsearch/llm/maintainer/TIPS.md

### model-postgres

- module/model-postgres/llm/consumer/OVERVIEW.md
- module/model-postgres/llm/consumer/INSTRUCTIONS.md
- module/model-postgres/llm/consumer/TIPS.md
- module/model-postgres/llm/maintainer/OVERVIEW.md
- module/model-postgres/llm/maintainer/INSTRUCTIONS.md
- module/model-postgres/llm/maintainer/TIPS.md

### model-mysql

- module/model-mysql/llm/consumer/OVERVIEW.md
- module/model-mysql/llm/consumer/INSTRUCTIONS.md
- module/model-mysql/llm/consumer/TIPS.md
- module/model-mysql/llm/maintainer/OVERVIEW.md
- module/model-mysql/llm/maintainer/INSTRUCTIONS.md
- module/model-mysql/llm/maintainer/TIPS.md

### model-sqlite

- module/model-sqlite/llm/consumer/OVERVIEW.md
- module/model-sqlite/llm/consumer/INSTRUCTIONS.md
- module/model-sqlite/llm/consumer/TIPS.md
- module/model-sqlite/llm/maintainer/OVERVIEW.md
- module/model-sqlite/llm/maintainer/INSTRUCTIONS.md
- module/model-sqlite/llm/maintainer/TIPS.md

### model-file

- module/model-file/llm/consumer/OVERVIEW.md
- module/model-file/llm/consumer/INSTRUCTIONS.md
- module/model-file/llm/consumer/TIPS.md
- module/model-file/llm/maintainer/OVERVIEW.md
- module/model-file/llm/maintainer/INSTRUCTIONS.md
- module/model-file/llm/maintainer/TIPS.md

### model-firestore

- module/model-firestore/llm/consumer/OVERVIEW.md
- module/model-firestore/llm/consumer/INSTRUCTIONS.md
- module/model-firestore/llm/consumer/TIPS.md
- module/model-firestore/llm/maintainer/OVERVIEW.md
- module/model-firestore/llm/maintainer/INSTRUCTIONS.md
- module/model-firestore/llm/maintainer/TIPS.md

### model-redis

- module/model-redis/llm/consumer/OVERVIEW.md
- module/model-redis/llm/consumer/INSTRUCTIONS.md
- module/model-redis/llm/consumer/TIPS.md
- module/model-redis/llm/maintainer/OVERVIEW.md
- module/model-redis/llm/maintainer/INSTRUCTIONS.md
- module/model-redis/llm/maintainer/TIPS.md

### model-s3

- module/model-s3/llm/consumer/OVERVIEW.md
- module/model-s3/llm/consumer/INSTRUCTIONS.md
- module/model-s3/llm/consumer/TIPS.md
- module/model-s3/llm/maintainer/OVERVIEW.md
- module/model-s3/llm/maintainer/INSTRUCTIONS.md
- module/model-s3/llm/maintainer/TIPS.md

### model-dynamodb

- module/model-dynamodb/llm/consumer/OVERVIEW.md
- module/model-dynamodb/llm/consumer/INSTRUCTIONS.md
- module/model-dynamodb/llm/consumer/TIPS.md
- module/model-dynamodb/llm/maintainer/OVERVIEW.md
- module/model-dynamodb/llm/maintainer/INSTRUCTIONS.md
- module/model-dynamodb/llm/maintainer/TIPS.md

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

- schema: hardening pass completed (consumer contract guardrails, maintainer compatibility/triage/checklist updates)
- runtime: hardening pass completed (consumer lifecycle defaults, maintainer env/shutdown triage)
- config: hardening pass completed (consumer precedence guardrails, maintainer source/override triage)
- di: hardening pass completed (consumer lifecycle/qualifier guardrails, maintainer resolution triage)
- compiler: hardening pass completed (consumer incremental guardrails, maintainer invalidation/event triage)
- manifest: hardening pass completed (consumer discovery/delta guardrails, maintainer classification/path triage)
- cli: hardening pass completed (consumer command-contract guardrails, maintainer registry/schema triage)
- web: hardening pass completed (consumer endpoint/interceptor guardrails, maintainer extraction/ordering triage)
- auth: hardening pass completed (consumer identity-permission guardrails, maintainer contract/context triage)
- cache: hardening pass completed (consumer key/eviction guardrails, maintainer decorator/serialization triage)
- openapi: hardening pass completed (consumer contract-artifact guardrails, maintainer traversal/output triage)
- terminal: hardening pass completed (consumer capability-aware output guardrails, maintainer writer/detection triage)
- repo: hardening pass completed (consumer release-workflow guardrails, maintainer scope/exec triage)
- registry: hardening pass completed (consumer lifecycle guardrails, maintainer adapter/index triage)
- context: hardening pass completed (consumer propagation guardrails, maintainer async-boundary triage)
- log: hardening pass completed (consumer formatter/appender guardrails, maintainer event-pipeline triage)
- auth-model: hardening pass completed (consumer decision/pitfall guidance, maintainer triage/checklist updates)
- auth-session: hardening pass completed (consumer decision/pitfall guidance, maintainer triage/checklist updates)
- auth-web: hardening pass completed (consumer decision/pitfall guidance, maintainer triage/checklist updates)
- auth-web-passport: hardening pass completed (consumer decision/pitfall guidance, maintainer triage/checklist updates)
- auth-web-session: hardening pass completed (consumer decision/pitfall guidance, maintainer triage/checklist updates)
- email: hardening pass completed (consumer decision/pitfall guidance, maintainer triage/checklist updates)
- image: hardening pass completed (consumer decision/pitfall guidance, maintainer triage/checklist updates)
- eslint: hardening pass completed (consumer decision/pitfall guidance, maintainer triage/checklist updates)
- email-compiler: hardening pass completed (consumer decision/pitfall guidance, maintainer triage/checklist updates)
- email-inky: hardening pass completed (consumer decision/pitfall guidance, maintainer triage/checklist updates)
- email-nodemailer: hardening pass completed (consumer decision/pitfall guidance, maintainer triage/checklist updates)
- web-http: hardening pass completed (consumer decision/pitfall guidance, maintainer triage/checklist updates)
- web-connect: hardening pass completed (consumer decision/pitfall guidance, maintainer triage/checklist updates)
- web-rpc: hardening pass completed (consumer decision/pitfall guidance, maintainer triage/checklist updates)
- web-upload: hardening pass completed (consumer decision/pitfall guidance, maintainer triage/checklist updates)
- web-aws-lambda: hardening pass completed (consumer decision/pitfall guidance, maintainer triage/checklist updates)
- worker: hardening pass completed (consumer decision/pitfall guidance, maintainer triage/checklist updates)
- doc: hardening pass completed (consumer decision/pitfall guidance, maintainer triage/checklist updates)
- pack: hardening pass completed (consumer decision/pitfall guidance, maintainer triage/checklist updates)
- scaffold: hardening pass completed (consumer decision/pitfall guidance, maintainer triage/checklist updates)
- schema-faker: hardening pass completed (consumer decision/pitfall guidance, maintainer triage/checklist updates)
- transformer: hardening pass completed (consumer decision/pitfall guidance, maintainer triage/checklist updates)
- model-indexed: hardening pass completed (consumer decision/pitfall guidance, maintainer triage/checklist updates)
- model-memory: hardening pass completed (consumer safe-default depth, maintainer compatibility/triage updates)
- model-query: hardening pass completed (consumer decision/pitfall guidance, maintainer verifier contract depth)
- model-query-language: hardening pass completed (consumer parsing guardrails, maintainer parser contract triage/checklists)
- model-sql: hardening pass completed (consumer decision guidance, maintainer compatibility/transaction triage depth)
- model-mongo: hardening pass completed (consumer operational defaults, maintainer id/config triage/checklists)
- model-elasticsearch: hardening pass completed (consumer query guardrails, maintainer id/translation triage/checklists)
- model-postgres: hardening pass completed (consumer composition defaults, maintainer transaction/introspection triage)
- model-mysql: hardening pass completed (consumer version-aware defaults, maintainer error/introspection triage)
- model-sqlite: hardening pass completed (consumer lock/concurrency defaults, maintainer retry/introspection triage)
- model-file: hardening pass completed (consumer filesystem guardrails, maintainer compatibility/scan triage)
- model-firestore: hardening pass completed (consumer indexed/config defaults, maintainer query/config triage)
- model-redis: hardening pass completed (consumer indexed guardrails, maintainer key/index triage)
- model-s3: hardening pass completed (consumer object-store defaults, maintainer multipart/key-schema triage)
- model-dynamodb: hardening pass completed (consumer index lifecycle guardrails, maintainer GSI/utility triage)
