# Model Query Language Maintainer Overview
Maintainer guidance for query-language tokenization, parsing, and query conversion behavior.

## Ownership
- Token model and keyword/operator mapping.
- Tokenizer behavior for literals, regex, arrays, grouping, and operators.
- Parser behavior for clause handling, unary/group composition, and query conversion.

## High-Signal Entry Points
- src/tokenizer.ts
- src/parser.ts
- src/types.ts
- src/model-query.ts
- support/test/

## Integration Boundaries
- Consumed by services and endpoints that target @travetto/model-query contracts.
- Must stay aligned with operator semantics accepted by `QueryVerifier` in @travetto/model-query.

Compatibility boundaries:
- Token and AST conversion behavior is externally observable through endpoint query semantics.
- Operator translation table entries are semver-sensitive whenever they alter emitted where-clause meaning.

## Invariants
- Tokenization rules must stay deterministic for quoting, escaping, regex literals, and numeric/time-like literals.
- Operator translation must remain consistent with model-query operator names.
- Grouping and unary behavior must preserve logical precedence and produce stable where-clause output.

## Extension Points
- Additive operator support should update tokenizer keywords, parser translation, and tests together.
- Payload model behavior in `QueryLanguageModelQuery.finalize` can be extended additively for new query fields.

## Testing Expectations
- Cover malformed literals, invalid operators, nested groupings, and list/operator mismatches.
- Validate conversion output against expected where-clause shapes.
- Run query-language support tests when changing parser or tokenizer code paths.

Change-triage guidance:
- Tokenizer changes: run literal/regex/escape-focused tests plus parser integration tests.
- Operator translation changes: run query-language tests and model-query verifier checks together.
- `finalize` changes: validate both JSON-like where input and expression-based where input paths.

## Risk Areas
- Regex parsing and escaped literal handling are regression-prone.
- Any operator-translation change can silently alter query meaning.
- Parser condensing/unary logic can change boolean precedence if modified carelessly.