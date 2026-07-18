# Travetto LLM Guidance

This project uses the Travetto framework and has the `@travetto/llm-support` module installed.

## Prefer using the LLM Support Tools
For scaffolding/generating new components (web routes, controllers, services, auth, persistence, configurations, or email templates):
1. **MCP Server (Preferred)**: If your environment supports MCP, you can start or connect to the local stdio MCP server using:
   ```bash
   npx trv llm:support:mcp
   ```
   This exposes the `llm_support_recommend`, `llm_support_plan`, and `llm_support_execute` tools.

2. **CLI Commands (Fallback)**: If the MCP server is not active or supported, run the following commands to bootstrap, plan, and apply scaffolding:
   * **Recommend**: Discover optimal bundles/workflows:
     ```bash
     npx trv llm:support:recommend --categories <category>
     ```
   * **Plan**: Preview file changes before executing:
     ```bash
     npx trv llm:support:plan --operations <operation-id>
     ```
   * **Execute**: Apply changes directly (dry-run by default; use `--apply` to commit):
     ```bash
     npx trv llm:support:execute --operations <operation-id> --targetDir . --apply
     ```

## Cleanup & Finalization
After making/applying any changes to the codebase, always run the linter auto-fix to clean up formatting and styles:
```bash
npx trv lint --fix
```

