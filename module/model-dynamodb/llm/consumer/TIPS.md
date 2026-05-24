# Model Dynamodb Tips
- Index definitions are operationally important; coordinate changes with deployment planning.
- Validate sort-field types for indexed sorted access patterns.
- Keep business logic on shared contracts, not direct DynamoDB API calls.
- Use local endpoint configuration for development and integration testing.