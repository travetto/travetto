# Scaffold Maintainer Overview
Maintainer guidance for template generation logic and feature-composition stability.

## Ownership
- Interactive generation workflow and prompts.
- Template rendering and file emission behavior.
- Feature-selection composition rules and defaults.

## High-Signal Entry Points
- src/
- doc/
- template/resource generation internals

## Integration Boundaries
- Consumes metadata from framework modules to compose starter apps.
- Output consumed by new projects as baseline source.

## Compatibility Boundaries
- Prompt choices and generated file layout are user-visible contracts.
- Template defaults impact first-run developer experience.

## Testing Expectations
- Validate feature combinations produce runnable output.
- Validate generated projects compile and execute basic commands.
- Validate template substitutions and path generation behavior.

## Change-Triage Guidance
- Prompt changes: verify UX flow and backward expectations.
- Template changes: diff generated project outputs.
- Feature wiring changes: run representative generated app tests.
