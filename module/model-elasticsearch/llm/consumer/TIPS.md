# Model Elasticsearch Tips
- Treat this provider as contract-driven: keep business logic on shared model/query interfaces.
- Scrolling and large result traversal should be bounded and monitored.
- Facet/suggest are powerful, so validate request shapes before execution.
- Keep index naming conventions predictable across environments.