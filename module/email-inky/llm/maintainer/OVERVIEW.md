# Email Inky Maintainer Overview
Maintainer guidance for JSX-to-inky template mapping and compilation compatibility.

## Ownership
- Component contract definitions for template authoring.
- Mustache-compatible control-flow/value helper behavior.
- Engine extension-point compatibility with email-compiler.

## High-Signal Entry Points
- src/components.ts
- src/renderer.*
- support/

## Integration Boundaries
- Consumed by email-compiler for artifact generation.
- Depends on stable component semantics and output translation behavior.

## Compatibility Boundaries
- Component props/behavior and emitted template shape are semver-sensitive.
- Control-flow/value helper rendering behavior is externally visible to template authors.

## Testing Expectations
- Validate component rendering for representative template layouts.
- Validate control-flow and substitution behavior compatibility.
- Recheck compile integration with email-compiler output expectations.

## Change-Triage Guidance
- Component API changes: verify existing template compatibility.
- Render changes: test emitted html/mustache structure stability.
- Extension changes: validate wrapper/style override interaction.
