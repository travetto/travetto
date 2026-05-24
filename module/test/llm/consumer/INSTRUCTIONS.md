# Test Instructions
How to author reliable tests with Travetto decorators.

## Setup
1. Mark suite classes with @Suite.
2. Mark test methods with @Test.
3. Add lifecycle hooks only where shared setup/cleanup is necessary.

## Usage Workflow
- Keep each @Test focused on a single behavior.
- Use @BeforeEach/@AfterEach for state reset.
- Use @Timeout for async tests that may block.
- Use @ShouldThrow for explicit failure-path assertions.

## Safe Defaults
- Keep tests deterministic and isolated.
- Prefer explicit fixtures over implicit global state.
- Keep lifecycle hooks lightweight and idempotent.
