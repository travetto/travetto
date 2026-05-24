# Model Maintainer Instructions

## Change Strategy
- Keep provider-agnostic behavior in core model module.
- Preserve lifecycle semantics and error contracts.

## Implementation Notes
- Treat decorator metadata changes as cross-provider breaking risks.
- Keep Model*Util contracts stable and additive where possible.
- Maintain subtype and expiry behavior compatibility.

## Validation
- Run model contract suites plus at least one provider integration suite.
- Validate lifecycle hooks and partial update flows for regressions.
