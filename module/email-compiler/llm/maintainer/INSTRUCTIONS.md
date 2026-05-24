# Email Compiler Maintainer Instructions

## Change Strategy
- Preserve compiled artifact conventions and output stability.
- Keep compile/watch behavior deterministic.
- Prefer additive engine/asset capabilities.

## Implementation Notes
- Keep rendering stages explicit and test-backed.
- Avoid hidden fallback behavior in asset resolution.
- Ensure generated artifact paths remain predictable.

## Validation
- Run module tests for compile/watch and output generation paths.
- Validate representative templates with images/styles and overrides.
- Recheck runtime loading compatibility with @travetto/email.

## Regression Checklist
- Output suffix/structure remains stable.
- Asset precedence remains deterministic.
- Compile/watch workflows remain predictable.
