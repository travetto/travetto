# Model Query Language Overview
The @travetto/model-query-language module provides a textual query syntax that compiles into the typed @travetto/model-query structure.

## What This Module Is
This module is a tokenizer and parser for a compact boolean query language, plus a small schema model for query payloads with paging and sorting fields.

## Why To Use It
- It gives users a human-readable query syntax for search endpoints.
- It converts query text into the same query-object shape used by model-query services.
- It keeps query parsing logic centralized instead of scattered across controllers.

## When To Use It
- Use it when users should supply filter expressions as text.
- Use it when you want one parser that can target multiple model-query backends.
- Use it when supporting operators like equality, range, membership, boolean grouping, and regex matching.

## When Not To Use It
- Do not use it when your application can safely build query objects directly in TypeScript.
- Do not use it as authorization logic; parsing a query is not permission validation.
- Do not assume parse success means the underlying provider can execute every clause efficiently.

## Core Capabilities
- Tokenize query text with `QueryLanguageTokenizer`.
- Parse text into query AST and convert to `WhereClauseRaw` with `QueryLanguageParser`.
- Build pageable query payloads with `QueryLanguageModelQuery.finalize`.
- Support boolean logic, groupings, `in` lists, and regex literals.

## Decorators
This module exposes no decorators for consumers. The exported `QueryLanguageModelQuery` class is internally annotated with `@Schema` from @travetto/schema.

## Utility Classes (Non-Internal)
- `QueryLanguageTokenizer`: converts input text into typed tokens.
- `QueryLanguageParser`: parses tokens into clauses/groups and converts to model-query where clauses.
- `QueryLanguageModelQuery`: helper model for query payload parsing and finalization.

## Core APIs and Extension Points
- `QueryLanguageTokenizer.tokenize(text)` produces token sequences.
- `QueryLanguageParser.parseToQuery(text)` produces a where-clause object.
- `QueryLanguageModelQuery.finalize(self)` converts serialized fields (`where`, `sort`, `limit`, `offset`) into `PageableModelQuery<T>`.

Decision guideline:
Use query-language parsing when filters come from user-entered expressions. Use direct typed query objects when query shape is authored in trusted application code.

## Typical Integration Flow
1. Accept query input text from request parameters.
2. Parse text with `QueryLanguageParser.parseToQuery`.
3. Combine parsed where-clause with typed sort/limit/offset values.
4. Pass the resulting query object to a model service implementing `ModelQuerySupport`.

## Practical Scenario
An admin UI sends `user.role in ['admin','root'] and not (status == 'disabled')` as a text filter. The API parses it into a model-query where-clause, adds pagination, and runs it through the active query-capable provider. The UI keeps one readable filter format while backend providers remain swappable.

Common pitfalls:
- Treating parse success as permission to run any clause without endpoint-level field/operator controls.
- Assuming all providers will execute regex and complex boolean clauses with similar performance.
- Mixing expression parsing and raw JSON where-clause parsing in one endpoint without explicit precedence rules.