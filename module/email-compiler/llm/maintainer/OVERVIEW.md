# Email Compiler Maintainer Overview
Maintainer guidance for template compilation pipeline, asset resolution, and output compatibility.

## Ownership
- Compile/watch command behavior.
- Template rendering orchestration and engine wrapper integration.
- Asset resolution precedence and generated output consistency.

## High-Signal Entry Points
- src/cli.*
- src/compiler.*
- src/asset.*
- support/

## Integration Boundaries
- Consumed by email engine modules and @travetto/email runtime template sends.
- Depends on consistent resource path and output conventions.

## Compatibility Boundaries
- Output naming conventions and artifact structure are semver-sensitive.
- Asset lookup precedence and wrapper semantics are externally visible.

## Testing Expectations
- Validate compile and watch mode behavior.
- Validate asset override precedence and fallback behavior.
- Recheck output compatibility with email runtime template loading.

## Change-Triage Guidance
- Pipeline changes: verify html/text/subject outputs remain compatible.
- Asset changes: test precedence and image embedding behavior.
- CLI changes: validate command flags/output for tooling users.
