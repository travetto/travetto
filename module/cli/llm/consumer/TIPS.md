# CLI Tips
- Treat command names and flags as stable contracts for users and agents.
- Verify schema output with npx trv cli:schema whenever command signatures change.
- Keep long-running commands restart-friendly with @CliRestartOnChangeFlag where useful.
- Prefer clear error output and non-zero exit codes for automation workflows.
