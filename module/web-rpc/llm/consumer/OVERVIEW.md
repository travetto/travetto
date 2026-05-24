# Web Rpc Overview
The @travetto/web-rpc module provides RPC-style client generation and invocation support for web endpoints.

## What This Module Is
This module generates typed proxy clients from web controller metadata and exposes command/config workflows for RPC consumption.

## Why To Use It
- It reduces manual client boilerplate for web endpoint access.
- It keeps RPC client contracts aligned with server-side controller types.
- It supports multiple client generation targets via CLI/config.

## When To Use It
- Use when frontend or service consumers need generated typed clients.
- Use when endpoint contract drift should be minimized through generated artifacts.
- Use when RPC-style invocation over HTTP is preferred for internal APIs.

## When Not To Use It
- Do not use when simple direct REST calls are sufficient and type-safe client generation is unnecessary.
- Do not manually hand-edit generated RPC client outputs.

## Core Capabilities
- CLI generation of RPC clients (`web:rpc-client`).
- Config-driven client generation profiles.
- Proxy-based client runtime with TypeScript type wiring.

## Decorators
- This module does not expose consumer decorators.

## Utility Classes (Non-Internal)
- This module does not expose consumer utility classes under non-internal paths.

## Core APIs and Extension Points
- `web:rpc-client` command and generation config surface.
- Client factory patterns for typed controller proxy bindings.
- RPC generation type targets (`config`, `node`, `web` patterns).

Decision guideline:
Use generated RPC clients as the canonical consumer contract for typed endpoint invocation when shared server-client type safety is required.

## Typical Integration Flow
1. Configure rpc client generation output in application config.
2. Run `trv web:rpc-client` (or config-driven generation).
3. Create typed client factory binding generated types.
4. Invoke controller methods through generated proxy client.

## Practical Scenario
For an internal dashboard, generate web-target RPC clients from backend controllers, bind controller type maps once, and consume API calls through strongly-typed proxies in UI code.

Common pitfalls:
- Treating generated clients as hand-maintained source files.
- Skipping regeneration after controller contract changes.
- Binding incorrect type maps and masking contract drift.
