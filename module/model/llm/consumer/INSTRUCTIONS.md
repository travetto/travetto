# Model Instructions
How to build robust model-driven persistence workflows.

## Setup
1. Annotate entity classes with @Model.
2. Add lifecycle decorators only where behavior is shared and deterministic.
3. Use a backing model provider module appropriate to your datastore.

## Usage Workflow
- Keep model classes focused on persistence-relevant fields.
- Use @Transient for computed fields not meant for storage.
- Use @PrePersist/@PersistValue for deterministic mutations before save.
- Use @PostLoad for normalization after read.

## Safe Defaults
- Favor explicit IDs and validation over implicit assumptions.
- Avoid provider-specific assumptions in model classes.
- Keep lifecycle handlers idempotent.
