# LLM Support Tips

- Start from user intent, not package names.
- Provide required packages before optional adapters.
- Use dependency graph checks to prevent missing prerequisites.
- Avoid recommending multiple datastore adapters unless the user explicitly requires a multi-store architecture.
- Re-run command discovery with npx trv cli:schema whenever command syntax confidence is low.
- Use the generated consumer-docs bundle to resolve module coverage before falling back to ad hoc file scans.
- Escalate to module-level consumer docs when users ask for decorator semantics or utility-level API details.
