# DI Tips
- Avoid circular dependencies; they indicate design issues.
- Use @Injectable selectively so only true services are managed by DI.
- For testing, use DependencyRegistryIndex override and registration hooks to swap dependencies.
- Use Factory patterns (@InjectableFactory) for complex object creation.
