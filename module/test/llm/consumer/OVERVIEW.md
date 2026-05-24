# Test Overview
The @travetto/test module provides decorator-driven test suite and test case orchestration with structured results.

## What This Module Is
This module is the framework-native test runner contract for suite registration, lifecycle hooks, assertion enrichment, and result reporting.

## Why To Use It
- It keeps test structure declarative and consistent.
- It integrates deeply with framework metadata and runtime behavior.
- It provides standardized result models for local and CI reporting.

## When To Use It
- Use for unit/integration suites in Travetto modules and applications.
- Use when lifecycle hooks and timeout/throw expectations are required.
- Use when test output needs machine-readable structured formats.

## When Not To Use It
- Do not mix incompatible test frameworks in the same flow unless explicitly isolated.
- Do not place setup/teardown logic directly in test bodies when lifecycle decorators fit better.

## Core Capabilities
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

## Core APIs and Extension Points
- @Suite and @Test decorators for core registration.
- Lifecycle decorators for setup/teardown composition.
- Test result model utilities for reporting integrations.

## Typical Integration Flow
1. Create suite classes with @Suite.
2. Define test methods with @Test.
3. Add @BeforeEach/@AfterEach and suite-level hooks as needed.
4. Run through framework test commands and consume structured output.

## Practical Scenario
For datastore adapter conformance tests, define shared suites with lifecycle setup and execute across providers while collecting uniform results for CI dashboards.

