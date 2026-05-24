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
3. Add model-persistence-stack only if persistence is requested.

### Add persistence
1. Start with model-persistence-stack.
2. Pick one adapter family (SQL or non-SQL) based on datastore and operational requirements.
3. Select exactly one primary adapter package for the active datastore.
4. Confirm index/query/blob/expiry needs match selected adapter capabilities.

### Add worker processing
1. Start with worker-baseline.
2. Add model modules only when jobs persist data.
3. Verify shutdown behavior assumptions against runtime guidance.

### Enable Google OAuth (Passport)
1. Start with auth-google-passport-web and enable-google-oauth-passport.
2. Configure google.auth values (clientID, clientSecret, callbackUrl) and bind via @Config.
3. Register PassportAuthenticator with Google OAuth strategy and explicit profile-to-principal mapping.
4. If persisting identities, add one model adapter and external-id indexed lookup.

### Scaffold web + OpenAPI service
1. Start with scaffold-web-openapi-service.
2. Confirm generated app includes web-http and OpenAPI endpoint support.
3. Add logging if runtime diagnostics are needed.

### Scaffold basic auth + session
1. Start with scaffold-auth-basic-session and scaffold-auth-basic-session workflow.
2. Confirm authenticator/authorizer/session store factories are present.
3. Verify /auth/login, /auth/self, and /auth/logout behavior in generated routes.

### Scaffold web + model CRUD
1. Start with scaffold-web-model-crud.
2. Confirm generated CRUD controller uses model-query compatible source.
3. Add auth/auth-web if principal-scoped record access is required.

### Scaffold model backend selection
1. Start with scaffold-model-backend-selection.
2. Choose one datastore adapter from scaffold-supported options.
3. Ensure SQL-family choices include shared SQL runtime requirements.

### Scaffold quality setup
1. Start with scaffold-quality-setup.
2. Confirm generated package scripts include test and lint commands.
3. Run test and lint immediately after generation.

## Verification Command
- Use trv llm:support:verify to run llm-support structure and contract checks.

## Recommendation Command
- Use trv llm:support:recommend to emit workflow and install guidance as text output by default.
- Filter with --workflow, --bundle, or --intent, and switch to --format json when structured output is required.
- Use --needs blob,query,indexed,expiry to narrow non-SQL adapter choices by required capabilities.
- Use --workflow enable-google-oauth-passport for provider-specific Google OAuth setup guidance.
- Use --workflow scaffold-web-openapi-service, scaffold-auth-basic-session, scaffold-web-model-crud, scaffold-model-backend-selection, or scaffold-quality-setup for scaffold-aligned guidance.
- Use trv llm:support:recommend:json for strict machine output with schemaVersion.
