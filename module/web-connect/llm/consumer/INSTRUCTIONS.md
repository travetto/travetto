# Web Connect Instructions
How to use connect middleware bridge integration safely.

## Setup
1. Install @travetto/web-connect.
2. Isolate connect middleware usage to integration adapters.
3. Use bridge invocation helpers where middleware compatibility is needed.

## Usage Workflow
- Adapt incoming web context through bridge utilities.
- Invoke middleware with explicit success/failure handling.
- Map middleware outcomes back into framework-specific contracts.

Minimal pattern:
1. Receive web context in integration layer.
2. Call `WebConnectUtil.invoke` with middleware handler.
3. Normalize result/errors for consuming module.

## Safe Defaults
- Keep bridge usage narrow and integration-focused.
- Do not rely on unsupported request/response mutation semantics.
- Keep middleware side effects explicit and tested.
