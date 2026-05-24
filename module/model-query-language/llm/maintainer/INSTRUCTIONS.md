# Model Query Language Maintainer Instructions

## Change Strategy
- Treat parser and tokenizer behavior as a public contract.
- Keep operator semantics aligned with @travetto/model-query.
- Prefer additive grammar changes over compatibility-breaking rewrites.

## Implementation Notes
- Update `TOKEN_MAPPING` and operator translation together.
- Keep parser error messages precise enough for API-layer validation responses.
- Ensure `finalize` continues to support both JSON-like payload fragments and expression parsing for `where`.

## Validation
- Re-run query-language tests for grammar and edge-case coverage.
- Spot-check compatibility by running parsed output through query verifier or a concrete query provider.

Regression checklist:
- Unary/group precedence (`not`, nested `and`/`or`) remains stable.
- Regex and escaped string literal behavior remains unchanged.
- Operator-to-where mapping produces the same structural output for existing expressions.