# Manifest Instructions
Working with project structure and metadata.

## Setup
- The manifest is automatically generated and managed by the framework.
- Avoid modifying the .travetto_manifest.json file manually.

## Usage Workflow
- Use ManifestContext to get information about the current project root.
- Use ManifestIndex to find files by module, role, or type.
- Refer to npx trv cli:schema for structural overview of your application components.

Minimal pattern:
1. Build/load manifest context once per workflow execution.
2. Query module/file metadata through ManifestIndex.
3. Apply delta utilities before expensive recompilation or codegen steps.

## Safe Defaults
- Use relative paths from the manifest root whenever possible.
- Rely on ManifestIndex.find for cross-platform file discovery.
- Keep path normalization and manifest serialization semantics stable.
