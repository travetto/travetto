# Web Upload Overview
The @travetto/web-upload module provides multipart upload handling integrated with web endpoint parameter binding.

## What This Module Is
This module bridges multipart form uploads into typed endpoint parameters using framework decorators and upload parsing utilities.

## Why To Use It
- It provides a consistent upload API in controllers.
- It centralizes multipart parsing behavior.
- It supports safe temporary file handling patterns.

## When To Use It
- Use when endpoints accept file uploads.
- Use when uploaded files should be injected directly into controller parameters.
- Use when multipart parsing should remain framework-managed.

## When Not To Use It
- Do not parse multipart payloads manually in controllers.
- Do not bypass upload lifecycle handling for temporary file safety.

## Core Capabilities
- Multipart parsing over busboy-backed processing.
- Decorator-driven upload parameter injection.
- Support for single-file and map-based upload structures.

## Decorators
- `@Upload`: bind uploaded file payload(s) to endpoint parameter types (`File`/`FileMap`).

## Utility Classes (Non-Internal)
- This module does not expose consumer utility classes under non-internal paths.

## Core APIs and Extension Points
- `@Upload` decorator.
- Upload-related types (`FileMap` and related upload payload contracts).
- Integration hooks with web body/parameter extraction pipeline.

Decision guideline:
Use `@Upload` parameter binding as the canonical upload surface for endpoints and keep file lifecycle logic centralized outside handler business code.

## Typical Integration Flow
1. Define endpoint accepting multipart input.
2. Add `@Upload` parameter for single or multiple files.
3. Process uploaded payload in service layer.
4. Persist or forward file content per domain needs.

## Practical Scenario
For profile image upload, bind file via `@Upload`, validate size/type in service logic, then store processed bytes using your chosen storage module.

Common pitfalls:
- Treating upload payloads as always single-file when clients can send multiple parts.
- Mixing manual body parsing with decorator-driven upload binding.
- Ignoring temporary file cleanup or storage handoff guarantees.
