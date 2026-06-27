import fs from 'node:fs/promises';
import path from 'node:path';

import { FileLoader, JSONUtil, RuntimeResources } from '@travetto/runtime';
import { SchemaValidator } from '@travetto/schema';

import { PackageJsonSchema, type PackageJsonShape } from './template-shapes.ts';
import type { ExecutionArtifact, ExecutionRequest, ExecutionResponse, PlanStepId } from './types.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toStringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

async function validatePackageJsonShape(payload: unknown, source: string): Promise<PackageJsonShape> {
  if (!isRecord(payload)) {
    throw new Error(`Invalid package json shape for ${source}`);
  }

  const bound = PackageJsonSchema.from(payload);
  await SchemaValidator.validate(PackageJsonSchema, bound);
  return bound;
}

async function readSnippet(name: string): Promise<string> {
  return RuntimeResources.readUTF8(`snippets/code/${name}`);
}

async function renderSnippet(name: string, params: Record<string, string> = {}): Promise<string> {
  const source = await readSnippet(name);
  return source.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_all, key: string) => params[key] ?? '');
}

function toClassName(input: string, fallback: string): string {
  const cleaned = input.trim() || fallback;
  return cleaned
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(part => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join('');
}

function toFileName(input: string, fallback: string): string {
  const cleaned = input.trim() || fallback;
  return cleaned
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]{1,30}/g, '-')
    .replace(/^-{1,10}|-{1,10}$/g, '')
    .toLowerCase();
}

function toPackageName(input: string, fallback: string): string {
  const cleaned = input.trim() || fallback;
  const normalized = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9-]{1,30}/g, '-')
    .replace(/^-{1,10}|-{1,10}$/g, '');

  const safe = normalized.replace(/^[._-]{1,30}/, '');
  return safe || fallback;
}

function toWorkspacePath(input: string | undefined, fallback = 'packages/app'): string {
  const cleaned = (input ?? '').trim();
  if (!cleaned) {
    return fallback;
  }

  const segments = cleaned
    .replace(/^\/{1,10}|\/{1,10}$/g, '')
    .split('/')
    .filter(Boolean)
    .map((part, idx) => toPackageName(part, idx === 0 ? 'packages' : 'app'));

  return segments.length ? segments.join('/') : fallback;
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function writeFile(
  operationId: string,
  fullPath: string,
  content: string,
  request: ExecutionRequest,
  artifacts: ExecutionArtifact[],
  stepId: PlanStepId = 'generate-artifacts'
): Promise<void> {
  const present = await exists(fullPath);
  if (present && !request.overwrite) {
    artifacts.push({
      operationId,
      file: fullPath,
      status: 'skipped',
      stepId,
      reason: 'File already exists. Use --overwrite to replace.'
    });
    return;
  }

  if (request.dryRun !== false) {
    artifacts.push({ operationId, file: fullPath, status: 'planned', stepId });
    return;
  }

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, 'utf8');
  artifacts.push({ operationId, file: fullPath, status: 'created', stepId });
}

type OperationFileSpec = {
  file: string;
  snippet: string;
  params?: Record<string, string> | ((baseDir: string, request: ExecutionRequest) => Record<string, string>);
};

type OperationId = ExecutionRequest['operations'][number];

const STATIC_OPERATION_SPECS: Partial<Record<OperationId, OperationFileSpec[]>> = {
  'email-transport-provider': [
    { file: 'src/email/provider.ts', snippet: 'email-transport-provider.ts.tpl' },
    { file: 'src/config/email.ts', snippet: 'email-config.ts.tpl' }
  ],
  'email-preview-snapshot': [{ file: 'test/email/preview.ts', snippet: 'email-preview-test.ts.tpl' }],
  'email-test-fixtures': [{ file: 'test/email/fixtures/transactional.json', snippet: 'email-fixture.json.tpl' }],
  'generate-test-suite': [
    { file: 'test/unit/example.ts', snippet: 'generate-test-suite.unit.ts.tpl' },
    { file: 'test/fixtures/example.json', snippet: 'generate-test-suite.fixture.json.tpl' }
  ],
  'workflow-gcp-deploy': [
    { file: '.github/workflows/deploy-api.yml', snippet: 'workflow-gcp-deploy.yml.tpl' }
  ],
  'workflow-cloudfront-deploy': [
    { file: '.github/workflows/deploy-ui.yml', snippet: 'workflow-cloudfront-deploy.yml.tpl' }
  ],
  'workflow-firebase-deploy': [
    { file: '.github/workflows/firebase-hosting-merge.yml', snippet: 'workflow-firebase-deploy.yml.tpl' }
  ],
  'create-web-interceptor': [
    { file: 'src/interceptor/request-logging.ts', snippet: 'create-web-interceptor.ts.tpl' }
  ],
  'cache-enhancements': [
    { file: 'src/service/cacheable.ts', snippet: 'cache-enhancements.service.ts.tpl' },
    { file: 'src/config/cache.ts', snippet: 'cache-enhancements.config.ts.tpl' }
  ],
  'enable-file-upload': [
    { file: 'src/web/upload.ts', snippet: 'enable-file-upload.controller.ts.tpl' },
    { file: 'src/config/upload.ts', snippet: 'enable-file-upload.config.ts.tpl' }
  ],
  'enable-auth-session': [
    { file: 'src/web/auth.ts', snippet: 'enable-auth-session.controller.ts.tpl' },
    { file: 'src/web/auth.config.ts', snippet: 'enable-auth-session.config.ts.tpl' }
  ],
  'openapi-spec-pipeline': [{ file: '.github/workflows/openapi-spec.yml', snippet: 'openapi-spec-pipeline.yml.tpl' }],
  'openapi-client-generation': [
    { file: '.github/workflows/openapi-client.yml', snippet: 'openapi-client-generation.yml.tpl' },
    { file: 'src/client/README.md', snippet: 'openapi-client-generation.readme.tpl' }
  ],
  'aws-lambda-package-and-deploy': [{ file: '.github/workflows/deploy-lambda.yml', snippet: 'aws-lambda-package-and-deploy.yml.tpl' }],
  'pack-docker-release': [{ file: '.github/workflows/docker-release.yml', snippet: 'pack-docker-release.yml.tpl' }],
  'repo-version-release': [{ file: '.github/workflows/repo-version-release.yml', snippet: 'repo-version-release.yml.tpl' }]
};

async function execFromSpecs(
  operationId: string,
  specs: OperationFileSpec[],
  baseDir: string,
  request: ExecutionRequest,
  artifacts: ExecutionArtifact[]
): Promise<void> {
  for (const spec of specs) {
    const params = typeof spec.params === 'function' ? spec.params(baseDir, request) : (spec.params ?? {});
    await writeFile(operationId, path.join(baseDir, spec.file), await renderSnippet(spec.snippet, params), request, artifacts);
  }
}

async function mergeLintPackageJson(
  operationId: string,
  baseDir: string,
  relativePath: string,
  fullPath: string,
  lintTemplate: string,
  request: ExecutionRequest,
  artifacts: ExecutionArtifact[],
  stepId: PlanStepId = 'generate-artifacts'
): Promise<void> {
  const present = await exists(fullPath);

  if (request.dryRun !== false) {
    artifacts.push({ operationId, file: fullPath, status: 'planned', stepId });
    return;
  }

  await fs.mkdir(path.dirname(fullPath), { recursive: true });

  if (!present) {
    await fs.writeFile(fullPath, lintTemplate, 'utf8');
    artifacts.push({ operationId, file: fullPath, status: 'created', stepId });
    return;
  }

  const loader = new FileLoader([baseDir]);
  const current = await validatePackageJsonShape(JSONUtil.fromUTF8(await loader.readUTF8(relativePath)), fullPath);
  const incoming = await validatePackageJsonShape(JSONUtil.fromUTF8(lintTemplate), 'enable-linting.package.json.tpl');

  const base = { ...current };

  const currentScripts = toStringMap(current.scripts);
  const incomingScripts = toStringMap(incoming.scripts);

  const scripts = { ...currentScripts };
  scripts['lint:register'] = incomingScripts['lint:register'] ?? 'trv eslint:register';
  scripts.lint = scripts.lint ?? incomingScripts.lint ?? 'npm run lint:register && trv eslint';
  scripts['lint:fix'] = scripts['lint:fix'] ?? incomingScripts['lint:fix'] ?? 'npm run lint:register && trv eslint --fix';

  const devDependencies = { ...toStringMap(current.devDependencies) };
  for (const [name, version] of Object.entries(toStringMap(incoming.devDependencies))) {
    if (!devDependencies[name]) {
      devDependencies[name] = version;
    }
  }

  const merged = {
    ...base,
    type: toOptionalString(current.type) ?? toOptionalString(incoming.type),
    scripts,
    devDependencies
  };

  await fs.writeFile(fullPath, `${JSONUtil.toUTF8(merged, { indent: 2 })}\n`, 'utf8');
  artifacts.push({ operationId, file: fullPath, status: 'created', stepId });
}

async function execProjectBootstrap(baseDir: string, request: ExecutionRequest, artifacts: ExecutionArtifact[]): Promise<void> {
  const projectName = request.projectName ?? path.basename(baseDir);
  const packageName = toPackageName(projectName, 'travetto-app');
  const monorepo = request.monorepo === true;
  const workspacePath = monorepo ? toWorkspacePath(request.workspacePath) : '';
  const workspaceName = monorepo ? toPackageName(request.workspaceName ?? `${packageName}-app`, `${packageName}-app`) : packageName;
  const appDir = monorepo ? path.join(baseDir, workspacePath) : baseDir;

  if (monorepo) {
    await writeFile(
      'project-bootstrap',
      path.join(baseDir, 'package.json'),
      await renderSnippet('project-bootstrap.monorepo.package.json.tpl', {
        projectName: packageName,
        workspaceName
      }),
      request,
      artifacts
    );

    await writeFile(
      'project-bootstrap',
      path.join(appDir, 'package.json'),
      await renderSnippet('project-bootstrap.package.json.tpl', { projectName: workspaceName }),
      request,
      artifacts
    );
  } else {
    await writeFile(
      'project-bootstrap',
      path.join(baseDir, 'package.json'),
      await renderSnippet('project-bootstrap.package.json.tpl', { projectName: packageName }),
      request,
      artifacts
    );
  }

  await writeFile(
    'project-bootstrap',
    path.join(appDir, 'resources/application.yml'),
    await renderSnippet('project-bootstrap.application.yml.tpl', { projectName }),
    request,
    artifacts
  );

  await writeFile(
    'project-bootstrap',
    path.join(appDir, 'src/service/home.ts'),
    await renderSnippet('project-bootstrap.home-service.ts.tpl'),
    request,
    artifacts
  );

  await writeFile(
    'project-bootstrap',
    path.join(appDir, 'src/web/home.ts'),
    await renderSnippet('project-bootstrap.home-controller.ts.tpl'),
    request,
    artifacts
  );
}

async function execCreateWebRoute(baseDir: string, request: ExecutionRequest, artifacts: ExecutionArtifact[]): Promise<void> {
  const routePath = (request.routePath ?? 'sample').replace(/^\/+/, '');
  const serviceName = toClassName(request.serviceName ?? `${routePath} service`, 'SampleService');
  const controllerName = toClassName(request.controllerName ?? `${routePath} controller`, 'SampleController');

  const serviceFile = toFileName(serviceName, 'sample-service').replace(/-service$/, '') || 'sample';
  const controllerFile = toFileName(controllerName, 'sample-controller').replace(/-controller$/, '') || 'sample';

  await writeFile(
    'create-web-route',
    path.join(baseDir, `src/service/${serviceFile}.ts`),
    await renderSnippet('create-web-route.service.ts.tpl', { serviceName }),
    request,
    artifacts
  );

  await writeFile(
    'create-web-route',
    path.join(baseDir, `src/web/${controllerFile}.ts`),
    await renderSnippet('create-web-route.controller.ts.tpl', {
      serviceName,
      serviceFile,
      routePath,
      controllerName
    }),
    request,
    artifacts
  );
}

async function execEmailCreateTemplate(baseDir: string, request: ExecutionRequest, artifacts: ExecutionArtifact[]): Promise<void> {
  const emailName = toFileName(request.emailName ?? 'transactional', 'transactional');
  await writeFile(
    'email-create-template',
    path.join(baseDir, `src/email/templates/${emailName}.mustache`),
    await renderSnippet('email-create-template.mustache.tpl'),
    request,
    artifacts
  );
}

async function execEmailContextSchema(baseDir: string, request: ExecutionRequest, artifacts: ExecutionArtifact[]): Promise<void> {
  const emailType = toClassName(request.emailName ?? 'transactional email', 'TransactionalEmail');
  await writeFile(
    'email-context-schema',
    path.join(baseDir, 'src/email/schema.ts'),
    await renderSnippet('email-context-schema.ts.tpl', { emailType }),
    request,
    artifacts
  );
}

async function execEmailRenderPipeline(baseDir: string, request: ExecutionRequest, artifacts: ExecutionArtifact[]): Promise<void> {
  const emailName = toFileName(request.emailName ?? 'transactional', 'transactional');
  await writeFile(
    'email-render-pipeline',
    path.join(baseDir, 'src/email/render.ts'),
    await renderSnippet('email-render-pipeline.ts.tpl', {
      emailName,
      renderName: toClassName(emailName, 'Transactional')
    }),
    request,
    artifacts
  );
}

async function execEmailSendFlow(baseDir: string, request: ExecutionRequest, artifacts: ExecutionArtifact[]): Promise<void> {
  const routePath = (request.sendRoutePath ?? 'email/send').replace(/^\/+/, '');
  await writeFile(
    'email-send-flow',
    path.join(baseDir, 'src/web/email.ts'),
    await renderSnippet('email-send-controller.ts.tpl', { routePath }),
    request,
    artifacts
  );
}

async function execModelIndexedAssistant(baseDir: string, request: ExecutionRequest, artifacts: ExecutionArtifact[]): Promise<void> {
  const modelName = toClassName(request.modelName ?? 'sample item', 'SampleItem');
  const modelFile = toFileName(modelName, 'sample-item');
  const modelVar = `${modelFile.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase())}`;

  await writeFile(
    'model-indexed-assistant',
    path.join(baseDir, `src/model/${modelFile}.ts`),
    await renderSnippet('model-indexed.model.ts.tpl', { modelName }),
    request,
    artifacts
  );

  await writeFile(
    'model-indexed-assistant',
    path.join(baseDir, `src/model/${modelFile}.indexes.ts`),
    await renderSnippet('model-indexed.indexes.ts.tpl', {
      modelName,
      modelFile,
      modelVar
    }),
    request,
    artifacts
  );

  await writeFile(
    'model-indexed-assistant',
    path.join(baseDir, `src/service/${modelFile}-indexed.ts`),
    await renderSnippet('model-indexed.service.ts.tpl', {
      modelName,
      modelFile,
      modelVar
    }),
    request,
    artifacts
  );
}

async function execModelQueryAssistant(baseDir: string, request: ExecutionRequest, artifacts: ExecutionArtifact[]): Promise<void> {
  const modelName = toClassName(request.modelName ?? 'sample item', 'SampleItem');
  const modelFile = toFileName(modelName, 'sample-item');

  await writeFile(
    'model-query-assistant',
    path.join(baseDir, `src/service/${modelFile}-query.ts`),
    await renderSnippet('model-query.service.ts.tpl', {
      modelName,
      modelFile
    }),
    request,
    artifacts
  );
}

async function execRestRpcClient(baseDir: string, request: ExecutionRequest, artifacts: ExecutionArtifact[]): Promise<void> {
  const routePath = (request.routePath ?? 'sample').replace(/^\/+/, '');
  const clientName = toClassName(`${routePath} client`, 'SampleClient');
  const clientFile = toFileName(clientName, 'sample-client').replace(/-client$/, '') || 'sample';

  await writeFile(
    'rest-rpc-client',
    path.join(baseDir, `src/client/${clientFile}.ts`),
    await renderSnippet('rest-rpc-client.client.ts.tpl', {
      routePath,
      clientName
    }),
    request,
    artifacts
  );

  await writeFile(
    'rest-rpc-client',
    path.join(baseDir, 'src/client/index.ts'),
    await renderSnippet('rest-rpc-client.index.ts.tpl', { clientName, clientFile }),
    request,
    artifacts
  );
}

async function execGenerateConfig(baseDir: string, request: ExecutionRequest, artifacts: ExecutionArtifact[]): Promise<void> {
  await execFromSpecs(
    'generate-config',
    [
      { file: 'src/config/app.ts', snippet: 'generate-config.app-config.ts.tpl' },
      {
        file: 'resources/application.yml',
        snippet: 'generate-config.application.yml.tpl',
        params: (dir, input): Record<string, string> => ({ projectName: input.projectName ?? path.basename(dir) })
      },
      { file: 'resources/local.yml', snippet: 'generate-config.local.yml.tpl' }
    ],
    baseDir,
    request,
    artifacts
  );
}

async function execEnableLinting(baseDir: string, request: ExecutionRequest, artifacts: ExecutionArtifact[]): Promise<void> {
  await mergeLintPackageJson(
    'enable-linting',
    baseDir,
    'package.json',
    path.join(baseDir, 'package.json'),
    await renderSnippet('enable-linting.package.json.tpl'),
    request,
    artifacts
  );
}

type OperationHandler = (baseDir: string, request: ExecutionRequest, artifacts: ExecutionArtifact[]) => Promise<void>;

function createStaticHandler(operationId: OperationId): OperationHandler {
  return async (baseDir: string, request: ExecutionRequest, artifacts: ExecutionArtifact[]): Promise<void> => {
    await execFromSpecs(operationId, STATIC_OPERATION_SPECS[operationId] ?? [], baseDir, request, artifacts);
  };
}

const OPERATION_HANDLERS: Partial<Record<ExecutionRequest['operations'][number], OperationHandler>> = {
  'project-bootstrap': execProjectBootstrap,
  'create-web-route': execCreateWebRoute,
  'email-create-template': execEmailCreateTemplate,
  'email-context-schema': execEmailContextSchema,
  'email-render-pipeline': execEmailRenderPipeline,
  'email-transport-provider': createStaticHandler('email-transport-provider'),
  'email-preview-snapshot': createStaticHandler('email-preview-snapshot'),
  'email-send-flow': execEmailSendFlow,
  'email-test-fixtures': createStaticHandler('email-test-fixtures'),
  'model-indexed-assistant': execModelIndexedAssistant,
  'model-query-assistant': execModelQueryAssistant,
  'rest-rpc-client': execRestRpcClient,
  'generate-config': execGenerateConfig,
  'generate-test-suite': createStaticHandler('generate-test-suite'),
  'workflow-gcp-deploy': createStaticHandler('workflow-gcp-deploy'),
  'workflow-cloudfront-deploy': createStaticHandler('workflow-cloudfront-deploy'),
  'workflow-firebase-deploy': createStaticHandler('workflow-firebase-deploy'),
  'create-web-interceptor': createStaticHandler('create-web-interceptor'),
  'cache-enhancements': createStaticHandler('cache-enhancements'),
  'enable-file-upload': createStaticHandler('enable-file-upload'),
  'enable-auth-session': createStaticHandler('enable-auth-session'),
  'enable-linting': execEnableLinting,
  'openapi-spec-pipeline': createStaticHandler('openapi-spec-pipeline'),
  'openapi-client-generation': createStaticHandler('openapi-client-generation'),
  'aws-lambda-package-and-deploy': createStaticHandler('aws-lambda-package-and-deploy'),
  'pack-docker-release': createStaticHandler('pack-docker-release'),
  'repo-version-release': createStaticHandler('repo-version-release')
};

export function getUnimplementedOperations(operationIds: string[]): string[] {
  return operationIds.filter(id => !OPERATION_HANDLERS[id]);
}

export async function executeOperations(input: ExecutionRequest): Promise<ExecutionResponse> {
  const request: ExecutionRequest = {
    ...input,
    dryRun: input.dryRun !== false
  };

  const targetDir = path.resolve(request.targetDir);
  const artifacts: ExecutionArtifact[] = [];
  const warnings: string[] = [];

  for (const operationId of request.operations) {
    const handler = OPERATION_HANDLERS[operationId];
    if (handler) {
      await handler(targetDir, request, artifacts);
    } else {
      warnings.push(`Operation ${operationId} has no executor yet.`);
    }
  }

  return {
    dryRun: request.dryRun !== false,
    targetDir,
    artifacts,
    warnings
  };
}
