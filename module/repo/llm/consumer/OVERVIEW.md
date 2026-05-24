# Repo Overview
The @travetto/repo module provides monorepo operational tooling for versioning, publishing, listing, and multi-module command execution.

## What This Module Is
This module is an operational command surface for workspace maintenance. It builds on package-manager workspace behavior and adds quality-of-life workflows for release and repository operations.

## Why To Use It
- You maintain a multi-module Travetto workspace and need consistent release operations.
- You need safe, repeatable commands for changed-module versioning/publishing.
- You need to execute commands across many modules with controlled concurrency.

## When To Use It
- Use during release management (`repo:version`, `repo:publish`).
- Use to inspect workspace state/dependency graph (`repo:list`).
- Use to run operational commands across modules (`repo:exec`).

## When Not To Use It
- Do not use for single-module projects where direct npm/yarn/pnpm commands are sufficient.
- Do not rely on it for application runtime behavior; this is tooling, not request-path code.

## Core Capabilities
- Changed-module-aware version workflows.
- Registry-aware publish workflow with dry-run safety.
- Workspace listing as list/graph/json outputs.
- Concurrent command execution across workspace modules.

## Decorators
- No consumer decorators.

## Utility Classes (Non-Internal)
- This module does not expose consumer utility classes under non-internal src paths.

## Core APIs and Extension Points
- Primary surface is CLI commands.
- RepoExecUtil exists in support tooling for multi-module command orchestration.

## Typical Integration Flow
1. Use repo:list to inspect module scope or changed modules.
2. Run repo:version for release-level updates.
3. Validate with dry-run publish.
4. Use repo:exec to perform bulk maintenance operations across modules.

## Practical Scenario
When preparing a release in a large monorepo, use changed-mode versioning plus dry-run publish to reduce release risk while keeping dependent module versions coherent.
