# Model Redis Maintainer Tips
- Small index-format changes can break existing data access patterns.
- Keep sorted-set encoding behavior explicit and covered by tests.
- Be conservative with scan algorithm changes under pagination.
- Preserve clear separation between contract behavior and Redis-specific optimization.