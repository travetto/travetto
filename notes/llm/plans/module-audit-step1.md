## Step 1: Module Inventory Matrix

Baseline inventory for every module under /Users/arcsine/Code/travetto/module.

| Module | DOC.tsx | README | DOC.html | doc/ | doc-exec/ | test/ | support/test/ | Notes |
|---|---|---|---|---|---|---|---|---|
| auth | Y | Y | Y | N | N | Y | N | No doc examples |
| auth-model | Y | Y | Y | Y | N | Y | Y | Strong docs and shared tests |
| auth-session | Y | Y | Y | N | N | N | Y | Shared suites only |
| auth-web | Y | Y | Y | Y | N | Y | Y | Strong docs and tests |
| auth-web-passport | Y | Y | Y | Y | N | Y | N | Direct tests only |
| auth-web-session | Y | Y | Y | Y | N | Y | Y | Strong docs and tests |
| cache | Y | Y | Y | Y | N | N | Y | Shared suites only |
| cli | Y | Y | Y | Y | Y | Y | N | Has doc-exec |
| compiler | Y | Y | Y | N | Y | N | N | No tests, has doc-exec |
| config | Y | Y | Y | Y | N | Y | N | Direct tests |
| context | Y | Y | Y | N | N | N | N | Thin surface, no tests |
| di | Y | Y | Y | Y | N | Y | N | Direct tests |
| doc | Y | Y | Y | Y | Y | N | N | Docs module, no direct tests |
| email | Y | Y | Y | Y | N | Y | N | Direct tests |
| email-compiler | Y | Y | Y | Y | N | N | N | No tests |
| email-inky | Y | Y | Y | Y | N | N | N | No tests |
| email-nodemailer | Y | Y | Y | Y | N | N | N | No tests |
| eslint | Y | Y | Y | N | N | N | N | Thin surface, no tests |
| image | Y | Y | Y | Y | N | Y | N | Direct tests |
| log | Y | Y | Y | Y | N | Y | N | Direct tests |
| manifest | Y | Y | Y | N | N | N | N | No tests |
| model | Y | Y | Y | N | Y | N | N | Has doc-exec, no tests |
| model-dynamodb | Y | Y | Y | N | N | Y | N | Direct tests |
| model-elasticsearch | Y | Y | Y | N | N | Y | N | Direct tests |
| model-file | Y | Y | Y | N | N | Y | N | Direct tests |
| model-firestore | Y | Y | Y | N | N | Y | N | Direct tests |
| model-indexed | Y | Y | Y | Y | N | N | Y | Shared suites only |
| model-memory | Y | Y | Y | N | N | Y | N | Direct tests |
| model-mongo | Y | Y | Y | N | N | Y | N | Direct tests |
| model-mysql | Y | Y | Y | N | N | Y | N | Direct tests |
| model-postgres | Y | Y | Y | N | N | Y | N | Direct tests |
| model-query | Y | Y | Y | Y | N | N | Y | Shared suites only |
| model-query-language | Y | Y | Y | N | N | Y | N | Direct tests |
| model-redis | Y | Y | Y | N | N | Y | N | Direct tests |
| model-s3 | Y | Y | Y | N | N | Y | N | Direct tests |
| model-sql | Y | Y | Y | N | N | N | Y | Shared suites only |
| model-sqlite | Y | Y | Y | N | N | Y | N | Direct tests |
| openapi | Y | Y | Y | N | N | Y | N | Direct tests |
| pack | Y | Y | Y | N | N | N | N | No tests |
| registry | Y | Y | Y | N | N | N | N | No tests |
| repo | Y | Y | Y | N | N | N | N | No tests |
| runtime | Y | Y | Y | Y | N | Y | N | Strong docs and direct tests |
| scaffold | Y | Y | Y | N | N | N | N | No tests |
| schema | Y | Y | Y | Y | N | Y | Y | Strong docs and shared tests |
| schema-faker | Y | Y | Y | N | N | Y | N | Direct tests |
| terminal | Y | Y | Y | N | N | N | N | No tests |
| test | Y | Y | Y | Y | N | Y | Y | Strong docs and shared tests |
| transformer | Y | Y | Y | N | N | N | N | No tests |
| web | Y | Y | Y | Y | N | Y | Y | Strong docs and shared tests |
| web-aws-lambda | Y | Y | Y | N | N | Y | Y | Shared web test infra |
| web-connect | Y | Y | Y | N | N | N | N | No tests |
| web-http | Y | Y | Y | Y | Y | Y | Y | Strong docs, doc-exec, shared tests |
| web-rpc | Y | Y | Y | N | Y | Y | N | Has doc-exec |
| web-upload | Y | Y | Y | Y | N | Y | Y | Strong docs and shared tests |
| worker | Y | Y | Y | N | N | N | N | No tests |

**Counts**
- Total modules: 55
- DOC.tsx: 55/55
- README.md: 55/55
- DOC.html: 55/55
- doc/: 40/55
- doc-exec/: 5/55
- test/: 38/55
- support/test/: 14/55

**Immediate observations**
1. Documentation structure is universal across module/*, so the docs audit is primarily a quality and freshness review.
2. The most significant variance is in testing surfaces, especially modules with no direct tests and no support/test/.
3. Several model/auth modules rely on shared suites rather than local direct tests, which should be treated as covered but needing deeper classification later.
4. A smaller set of tooling and infrastructure modules have authored docs but no example directories and no visible test surface, which makes them likely step 4 and step 5 hotspots.