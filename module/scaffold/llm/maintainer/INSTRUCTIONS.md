# Scaffold Maintainer Instructions

## Change Strategy
- Preserve intuitive generator UX and stable defaults.
- Keep templates explicit and easy to diff.
- Prefer additive features over disruptive prompt rewrites.

## Implementation Notes
- Keep feature dependency logic centralized.
- Ensure generated output is deterministic for same selections.
- Avoid hidden assumptions about developer machine setup.

## Validation
- Run scaffold tests and generate representative projects.
- Verify generated project startup/test commands.
- Recheck prompt flow for all primary feature paths.

## Regression Checklist
- Generation flow remains stable.
- Template output remains coherent and runnable.
- Feature combinations remain valid.
