# Auth Web Passport Tips
- Keep provider-specific fields in principal.details, not top-level contracts.
- Validate callback route auth state explicitly.
- Keep strategy configuration externalized by environment.
- Recheck adapter behavior when changing web transport layers.
