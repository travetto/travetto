# Test Overview
The @travetto/test module provides decorator-driven test suite and test case orchestration with structured results.

## Primary Capabilities
- Declarative suite and test method registration.
- Lifecycle hooks for setup and teardown phases.
- Test behavior controls (timeouts, expected throw).
- Structured suite/test result models for reporting.

## Decorators
- @Suite: declare a test suite class.
- @Test: declare an individual test case.
- @BeforeAll and @AfterAll: suite-wide setup/cleanup.
- @BeforeEach and @AfterEach: per-test setup/cleanup.
- @ShouldThrow: assert that a test should throw.
- @Timeout: set per-test timeout behavior.
- @AssertCheck: mark assertion checks for richer diagnostics.

## Utility Classes (Non-Internal)
- TestModelUtil: helper functions to create and aggregate test/suite result structures.

## When to use it
Use this module for framework-native test suites, lifecycle-managed test execution, and structured test reporting.
