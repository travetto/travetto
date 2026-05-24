# Auth Session Tips
- Follow load -> mutate -> persist ordering consistently.
- Keep session data schema stable across deploys.
- Use expiry-capable model providers for predictable cleanup.
- Keep logout/session-destroy behavior explicit and tested.
