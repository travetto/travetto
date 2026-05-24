# Image Instructions
How to apply image conversion safely.

## Setup
1. Install @travetto/image.
2. Supply input streams/files from your pipeline.
3. Use `ImageUtil` conversion APIs with explicit options.

## Usage Workflow
- Keep conversion operations stream-based.
- Set explicit width/height/format options per target use case.
- Pipe transformed output to destination storage or response.

Minimal pattern:
1. Open input stream.
2. Call `ImageUtil.convert` with target options.
3. Pipe output stream and handle errors.

## Safe Defaults
- Keep resize/format targets explicit and documented.
- Validate conversion output for representative source image types.
- Keep conversion logic centralized to avoid profile drift.
