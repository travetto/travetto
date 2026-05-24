# Model Elasticsearch Instructions
How to use the Elasticsearch-backed model provider safely.

## Setup
1. Install @travetto/model-elasticsearch and configure `model.elasticsearch`.
2. Ensure hosts/options are valid for your environment.
3. Resolve `ElasticsearchModelService` via DI.

## Usage Workflow
- Use query contracts for flexible filtering, faceting, and suggestions.
- Use indexed contracts for deterministic key-based retrieval.
- Use bulk operations for high-volume writes.
- Keep endpoint-level bounds on paging and query complexity.

Minimal pattern:
1. Keep provider resolution and config wiring in a single startup boundary.
2. Route search-heavy API flows through typed query adapters.
3. Enforce request allowlists and paging caps before provider execution.

## Safe Defaults
- Keep index namespace explicit per environment.
- Set conservative API limits for search-heavy endpoints.
- Validate behavior after model changes when relying on development-time schema updates.
- Log normalized query/sort inputs to speed up production triage.