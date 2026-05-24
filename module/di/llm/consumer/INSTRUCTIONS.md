# DI Instructions
Effective use of Dependency Injection.

## Setup
1. Define services using the @Injectable decorator.
2. Ensure components are automatically discovered via the manifest.

## Usage Workflow
- Declare dependencies in the constructor or using the @Inject decorator.
- Use DependencyRegistryIndex.getInstance(MyService) for manual retrieval if necessary.
- Use @PostConstruct for startup logic that depends on injected values.

## Safe Defaults
- Prefer constructor injection for better testability and clarity.
- Use @Injectable() without arguments for standard singletons.
- Use @InjectableFactory only when constructor-based provisioning is insufficient.
