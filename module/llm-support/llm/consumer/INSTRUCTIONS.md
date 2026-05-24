# LLM Support Instructions

## Setup
1. Ensure module-level LLM docs are present for each referenced module.
2. Load task guidance from src/workflow-guidance.ts.
3. Load package guidance from src/install-guidance.ts.
4. Load bundled consumer docs from the generated src/consumer-docs.ts source.

## Usage Workflow
1. Classify the user request into one of the supported workflow intents.
2. Recommend the minimum required package set from INSTALL_BUNDLES.
3. Expand only as needed using DEPENDENCY_GRAPH optional adapters.
4. Validate command recommendations against npx trv cli:schema for CLI-facing modules.
5. Include verification notes so users can confirm selected modules are correctly aligned.

## Safe Defaults
- Prefer minimal viable required packages first and optional adapters second.
- Prefer explicit required versus optional distinctions in every recommendation.
- Prefer schema-validated command argument guidance over remembered command forms.
- Prefer linking to module-level docs for implementation detail once installation guidance is complete.
- Prefer the packaged consumer-docs bundle when reconstructing module coverage.

## Cross-Module Troubleshooting
- If recommendations conflict across modules, prefer direct package dependency constraints first, then consumer role-doc narrative guidance.
- If a command example and docs disagree, treat npx trv cli:schema output as authoritative.
- If more than one adapter appears valid, ask for deployment target and durability requirements before finalizing package advice.
- If a required package appears optional in a module narrative, verify against package.json dependency declarations before answering.

## Task Playbooks

### Build a web API
1. Start with web-api-baseline.
2. Add auth-enabled-web only if identity or permission requirements exist.
3. Add model-sql-stack only if persistence is requested.

### Add persistence
1. Start with model-sql-stack for SQL targets or switch adapter families for non-SQL stores.
2. Select exactly one adapter package for the active datastore.
3. Confirm index/query needs match selected adapter capabilities.

### Add worker processing
1. Start with worker-baseline.
2. Add model modules only when jobs persist data.
3. Verify shutdown behavior assumptions against runtime guidance.

## Verification Command
- Use trv llm:support:verify to run llm-support structure and contract checks.
