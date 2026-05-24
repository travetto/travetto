# Model S3 Overview
The @travetto/model-s3 module provides an S3-backed implementation of model and blob persistence contracts.

## What This Module Is
This module exports `S3ModelService` and `S3ModelConfig` for CRUD, blob, expiry, and storage lifecycle operations using S3-compatible object storage.

## Why To Use It
- It supports object-store-backed persistence and streaming-friendly blob handling.
- It combines model document storage and binary blob workflows in one provider.
- It allows S3-compatible local development through endpoint configuration.

## When To Use It
- Use it when S3 or S3-compatible object storage is your persistence backend.
- Use it when blob content and model records should live in the same storage provider.
- Use it when signed URL and range-read blob patterns are required.

## When Not To Use It
- Do not use it when indexed or rich query model contracts are required.
- Do not assume object storage semantics match low-latency database workloads.
- Do not store credentials directly in source-controlled config.

## Core Capabilities
- `S3ModelService` supports CRUD, blob operations, expiry-aware behavior, and storage lifecycle.
- Multipart upload support for large blob payloads.
- Signed URL generation and ranged blob reads.
- Namespaced key resolution and environment-aware endpoint configuration.

## Decorators
This module exposes no decorators.

## Utility Classes (Non-Internal)
This module exposes no standalone utility classes; primary API is `S3ModelService` and `S3ModelConfig`.

## Core APIs and Extension Points
- `S3ModelConfig` is bound at `model.s3` and controls region, bucket, endpoint, and credentials.
- `S3ModelService` is the runtime provider surface for CRUD/blob/expiry/storage contracts.
- Service wiring can be customized via DI factory registration.

## Typical Integration Flow
1. Configure `model.s3` bucket, region, credentials, and optional local endpoint.
2. Resolve `S3ModelService` through DI as active provider.
3. Use model CRUD methods for documents and blob methods for binary data.
4. Use storage lifecycle methods for setup/teardown workflows.

## Practical Scenario
A media workflow persists metadata documents and large assets in S3. The service stores model records through CRUD contract methods, uploads media through multipart blob APIs, and serves temporary download links through signed URL support while keeping domain code contract-oriented.