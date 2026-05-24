# Model Query Language Instructions
How to add safe text-query parsing to model-query workflows.

## Setup
1. Use a model provider that supports @travetto/model-query contracts.
2. Accept text query input from users or API clients.
3. Parse query text before passing it to the provider.

## Usage Workflow
- Parse raw text with `QueryLanguageParser.parseToQuery`.
- Use `QueryLanguageModelQuery` for payloads that include `where`, `sort`, `limit`, and `offset` as strings/numbers.
- Normalize and validate request-level constraints (max limit, allowed sort fields) in application code.
- Forward the finalized query object to `query`, `queryOne`, or `queryCount`.

Minimal pattern:
1. Keep parser invocation in a dedicated boundary layer (controller or search adapter).
2. Normalize user input and convert to typed query object once.
3. Apply allowlists for fields/operators before sending to provider methods.

## Safe Defaults
- Treat parse errors as user-input errors and return clear validation messages.
- Restrict which fields and operators your endpoint allows for public clients.
- Keep paging limits bounded to avoid accidental high-cost queries.
- Log normalized query output for troubleshooting parser-to-provider mismatches.