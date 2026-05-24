# Image Overview
The @travetto/image module provides image transformation and optimization utilities for build-time and runtime workflows.

## What This Module Is
This module exposes stream-friendly image conversion/resizing operations, primarily backed by sharp, for use in email, asset, and processing pipelines.

## Why To Use It
- It centralizes image transformation behavior in one module.
- It supports fast in-process conversion flows.
- It fits both service-level and batch/CLI usage patterns.

## When To Use It
- Use when resizing/optimizing image inputs for delivery.
- Use when build or processing pipelines need deterministic image conversions.
- Use when stream-based image handling is required.

## When Not To Use It
- Do not shell out to ad hoc image tools when module conversions are sufficient.
- Do not load entire large files into memory when stream conversions are available.

## Core Capabilities
- In-process image conversion and resizing.
- Stream-based processing compatible with file/network pipelines.
- Utility support for optimizer-style workflows.

## Decorators
- This module does not expose consumer decorators.

## Utility Classes (Non-Internal)
- `ImageUtil`: core conversion/resize helpers.

## Core APIs and Extension Points
- `ImageUtil.convert` and related transformation helpers.
- Conversion option types for target dimensions and format behavior.

Decision guideline:
Use stream-based image utility flows as the canonical approach for scalable image processing in framework-integrated workflows.

## Typical Integration Flow
1. Acquire source image as stream/input.
2. Apply conversion/resize options through `ImageUtil`.
3. Pipe output stream to file/object storage/response sink.
4. Validate output dimensions/format expectations in tests.

## Practical Scenario
For email asset preprocessing, resize large source images during compile/build pipeline to reduce payload sizes and keep rendering consistent.

Common pitfalls:
- Ignoring orientation/format nuances when converting mixed source files.
- Performing blocking file operations around otherwise stream-safe workflows.
- Assuming one conversion profile fits all delivery channels.
