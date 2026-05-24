# Model SQL Instructions
How to use SQL-backed model services safely.

## Setup
1. Choose a concrete SQL provider module that depends on model-sql.
2. Configure `model.sql` connection and namespace settings.
3. Ensure storage/model initialization is enabled when schema updates are expected.

## Usage Workflow
- Use the provider's injected model service for CRUD/query/bulk/indexed operations.
- Use `@Transactional` on multi-step write methods that must be atomic.
- Keep query and indexed reads separated by intent: broad filters use query contracts, deterministic lookups use indexed contracts.
- Use `exportModel` in tooling contexts when you need generated SQL schema insight.

Minimal pattern:
1. Compose provider selection and model service wiring in one DI boundary.
2. Keep transaction boundaries in service methods, not in controller handlers.
3. Validate one representative integration flow on every concrete SQL backend you support.

## Safe Defaults
- Keep transaction boundaries explicit around write-heavy workflows.
- Cap paging limits and avoid unbounded scans in API endpoints.
- Treat SQL schema assumptions as framework-guided, not legacy-schema compatible by default.
- Keep provider-specific SQL tuning in provider modules rather than application services.