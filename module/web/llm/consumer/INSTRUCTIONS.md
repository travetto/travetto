# Web Instructions
Recommended flow for building HTTP endpoints.

## Setup
1. Create a controller and annotate it with @Controller.
2. Add endpoint methods using HTTP decorators.
3. Declare request parameters with the matching parameter decorators.

## Usage Workflow
- Keep endpoint signatures strongly typed.
- Use @Produces/@Accepts to make content negotiation explicit.
- Use interceptors for auth, logging, caching, and cross-cutting policies.
- Use @ConditionalRegister for environment-specific endpoint exposure.

Minimal pattern:
1. Define route and HTTP method with controller/endpoint decorators.
2. Bind all inputs through explicit parameter decorators.
3. Apply cross-cutting behavior through interceptor composition.

## Safe Defaults
- Prefer explicit parameter decorators over manual request parsing.
- Keep endpoint methods thin and delegate business logic to services.
- Keep response metadata declarative and consistent.
- Keep endpoint signatures and metadata stable for generated docs and clients.
