# Model Mongo Overview
The @travetto/model-mongo module provides a MongoDB-backed implementation of Travetto model contracts.

## What This Module Is
This module exports `MongoModelService` and `MongoModelConfig` to support CRUD, bulk, blob, expiry, indexed, query, facet, and suggest operations on MongoDB.

## Why To Use It
- It offers broad model capability coverage in one provider.
- It aligns MongoDB operations with Travetto model and query contracts.
- It supports dynamic schema evolution naturally through MongoDB document storage.

## When To Use It
- Use it when MongoDB is your primary application datastore.
- Use it when you need both indexed and query-based read patterns in one provider.
- Use it when blob storage via GridFS should live alongside model data.

## When Not To Use It
- Do not use it when your deployment requires strict relational joins and relational schema guarantees.
- Do not assume Mongo-specific query features are portable to non-Mongo providers.
- Do not treat dynamic-schema flexibility as a substitute for explicit model validation.

## Core Capabilities
- `MongoModelService` implements model CRUD, storage, bulk, expiry, indexed, query, facet, and suggest contracts.
- `MongoModelConfig` supports connection strings, host lists, auth, TLS options, namespace, and cull behavior.
- GridFS integration for blob content and metadata.
- Model/index lifecycle support through provider storage/model operations.

## Decorators
This module exposes no decorators.

## Utility Classes (Non-Internal)
This module exports no standalone utility classes. The primary public API is `MongoModelService` and `MongoModelConfig`.

## Core APIs and Extension Points
- `MongoModelConfig` (bound to `model.mongo`) controls connection and runtime behavior.
- `MongoModelService` is the extension seam for custom provider wiring via DI factory registration.
- `ModelBlobNamespace` identifies the blob bucket namespace.

## Typical Integration Flow
1. Configure `model.mongo` settings (or a connection string) for your environment.
2. Register/resolve `MongoModelService` as the active model provider.
3. Use model/query/indexed contracts from application code.
4. Store/retrieve large binary payloads via blob support when needed.

## Practical Scenario
A multi-tenant API uses MongoDB for user/account documents and file metadata. The service uses query contracts for filtered search, indexed contracts for deterministic lookups, and GridFS blob support for uploaded artifacts. Tenant isolation is controlled with namespaced configuration while keeping model APIs consistent.