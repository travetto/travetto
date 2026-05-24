# Manifest Tips
- The manifest is the source of truth for the compiler; ensure package.json names are unique.
- Use ManifestContext.workspace.path to avoid hardcoding absolute paths.
- If experiencing resolution issues, check the npx trv cli:schema output for module visibility.
- Note that the manifest is created once during build/start and updated incrementally.
