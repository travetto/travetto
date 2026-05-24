# Doc Maintainer Overview
Maintainer guidance for documentation node rendering, CLI generation, and output stability.

## Ownership
- Document AST/node rendering behavior.
- CLI `doc` command execution and output writing.
- Source reference/linking behavior in generated docs.

## High-Signal Entry Points
- src/
- support/
- DOC.tsx usage contracts across modules

## Integration Boundaries
- Consumed by every module using generated docs.
- Integrates with command execution and source lookup utilities.

## Compatibility Boundaries
- Node component semantics and output format are externally visible.
- CLI flags and generation behavior are semver-sensitive.

## Testing Expectations
- Validate markdown/html output for representative documents.
- Validate reference/link generation against real module sources.
- Validate CLI watch/non-watch behavior for content updates.

## Change-Triage Guidance
- Renderer changes: diff generated output for regressions.
- CLI changes: verify flags/output behavior in automation paths.
- Node changes: confirm backwards compatibility for existing DOC.tsx files.
