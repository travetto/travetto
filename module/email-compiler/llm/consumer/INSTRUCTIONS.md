# Email Compiler Instructions
How to compile and maintain email template artifacts.

## Setup
1. Install @travetto/email-compiler and an engine module (for example @travetto/email-inky).
2. Place source templates and assets in expected support/resources locations.
3. Configure any wrapper/style override files required by your engine.

## Usage Workflow
- Run compile command for one-shot artifact generation.
- Use watch mode during iterative template development.
- Validate generated html/text/subject artifacts before release.

Minimal pattern:
1. Edit source template/style assets.
2. Run `trv email:compile` (or watch mode).
3. Inspect generated artifacts and send test emails.

## Safe Defaults
- Keep compiled artifacts generated from CI/build, not manual edits.
- Keep asset override paths explicit and documented.
- Validate image embedding and stylesheet optimization on representative templates.
