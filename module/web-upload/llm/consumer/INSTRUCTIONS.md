# Web Upload Instructions
How to handle file uploads safely in web endpoints.

## Setup
1. Install @travetto/web-upload.
2. Define upload endpoints with multipart-capable request handling.
3. Add `@Upload` parameters for file payload binding.

## Usage Workflow
- Use `@Upload` for single file (`File`) or grouped uploads (`FileMap`).
- Keep validation (size/type/name) in service or interceptor logic.
- Move uploaded data to durable storage as part of request processing.

Minimal pattern:
1. Declare `@Upload` endpoint parameter.
2. Validate upload metadata/content.
3. Persist/process file and return domain response.

## Safe Defaults
- Keep upload size and type checks explicit.
- Keep upload processing outside controllers where possible.
- Ensure temporary upload artifacts are not left unmanaged.
