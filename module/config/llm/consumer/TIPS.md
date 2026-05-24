# Config Tips
- Avoid using process.env directly; use @Config for type safety.
- Keep secrets out of your repository; use environment variables or secret managers.
- Use nested objects in your config classes to organize complex settings.
- Validate configuration values using @Schema decorators on your config class.
- Use @EnvVar for fields where runtime env names do not match default field-derived naming.
- If an env override is not applying, verify the exact @EnvVar name/alias and casing.
- Prefer explicit @EnvVar mappings for critical settings to avoid ambiguity across environments.
