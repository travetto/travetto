import fs from 'node:fs/promises';
import path from 'node:path';

import type { ExecutionArtifact, ExecutionRequest, ExecutionResponse } from './types.ts';

const SNIPPET_DIR = new URL('../resources/snippets/code/', import.meta.url);

async function renderSnippet(name: string, params: Record<string, string> = {}): Promise<string> {
  const source = await fs.readFile(new URL(name, SNIPPET_DIR), 'utf8');
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
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
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
  artifacts: ExecutionArtifact[]
): Promise<void> {
  const present = await exists(fullPath);
  if (present && !request.overwrite) {
    artifacts.push({
      operationId,
      file: fullPath,
      status: 'skipped',
      reason: 'File already exists. Use --overwrite to replace.'
    });
    return;
  }

  if (request.dryRun !== false) {
    artifacts.push({ operationId, file: fullPath, status: 'planned' });
    return;
  }

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, 'utf8');
  artifacts.push({ operationId, file: fullPath, status: 'created' });
}

async function execProjectBootstrap(
  baseDir: string,
  request: ExecutionRequest,
  artifacts: ExecutionArtifact[]
): Promise<void> {
  const projectName = request.projectName ?? path.basename(baseDir);

  await writeFile(
    'project-bootstrap',
    path.join(baseDir, 'resources/application.yml'),
    await renderSnippet('project-bootstrap.application.yml.tpl', { projectName }),
    request,
    artifacts
  );

  await writeFile(
    'project-bootstrap',
    path.join(baseDir, 'src/service/home.ts'),
    await renderSnippet('project-bootstrap.home-service.ts.tpl'),
    request,
    artifacts
  );

  await writeFile(
    'project-bootstrap',
    path.join(baseDir, 'src/web/home.ts'),
    await renderSnippet('project-bootstrap.home-controller.ts.tpl'),
    request,
    artifacts
  );
}

async function execCreateWebRoute(
  baseDir: string,
  request: ExecutionRequest,
  artifacts: ExecutionArtifact[]
): Promise<void> {
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

async function execEmailCreateTemplate(
  baseDir: string,
  request: ExecutionRequest,
  artifacts: ExecutionArtifact[]
): Promise<void> {
  const emailName = toFileName(request.emailName ?? 'transactional', 'transactional');
  await writeFile(
    'email-create-template',
    path.join(baseDir, `src/email/templates/${emailName}.mustache`),
    await renderSnippet('email-create-template.mustache.tpl'),
    request,
    artifacts
  );
}

async function execEmailContextSchema(
  baseDir: string,
  request: ExecutionRequest,
  artifacts: ExecutionArtifact[]
): Promise<void> {
  const emailType = toClassName(request.emailName ?? 'transactional email', 'TransactionalEmail');
  await writeFile(
    'email-context-schema',
    path.join(baseDir, 'src/email/schema.ts'),
    await renderSnippet('email-context-schema.ts.tpl', { emailType }),
    request,
    artifacts
  );
}

async function execEmailRenderPipeline(
  baseDir: string,
  request: ExecutionRequest,
  artifacts: ExecutionArtifact[]
): Promise<void> {
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

async function execEmailTransportProvider(
  baseDir: string,
  request: ExecutionRequest,
  artifacts: ExecutionArtifact[]
): Promise<void> {
  await writeFile(
    'email-transport-provider',
    path.join(baseDir, 'src/email/provider.ts'),
    await renderSnippet('email-transport-provider.ts.tpl'),
    request,
    artifacts
  );

  await writeFile(
    'email-transport-provider',
    path.join(baseDir, 'src/config/email.ts'),
    await renderSnippet('email-config.ts.tpl'),
    request,
    artifacts
  );
}

async function execEmailPreviewSnapshot(
  baseDir: string,
  request: ExecutionRequest,
  artifacts: ExecutionArtifact[]
): Promise<void> {
  await writeFile(
    'email-preview-snapshot',
    path.join(baseDir, 'test/email/preview.ts'),
    await renderSnippet('email-preview-test.ts.tpl'),
    request,
    artifacts
  );
}

async function execEmailSendFlow(
  baseDir: string,
  request: ExecutionRequest,
  artifacts: ExecutionArtifact[]
): Promise<void> {
  const routePath = (request.sendRoutePath ?? 'email/send').replace(/^\/+/, '');
  await writeFile(
    'email-send-flow',
    path.join(baseDir, 'src/web/email.ts'),
    await renderSnippet('email-send-controller.ts.tpl', { routePath }),
    request,
    artifacts
  );
}

async function execEmailTestFixtures(
  baseDir: string,
  request: ExecutionRequest,
  artifacts: ExecutionArtifact[]
): Promise<void> {
  await writeFile(
    'email-test-fixtures',
    path.join(baseDir, 'test/email/fixtures/transactional.json'),
    await renderSnippet('email-fixture.json.tpl'),
    request,
    artifacts
  );
}

async function execModelIndexedAssistant(
  baseDir: string,
  request: ExecutionRequest,
  artifacts: ExecutionArtifact[]
): Promise<void> {
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

async function execModelQueryAssistant(
  baseDir: string,
  request: ExecutionRequest,
  artifacts: ExecutionArtifact[]
): Promise<void> {
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

async function execRestRpcClient(
  baseDir: string,
  request: ExecutionRequest,
  artifacts: ExecutionArtifact[]
): Promise<void> {
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

async function execGenerateConfig(
  baseDir: string,
  request: ExecutionRequest,
  artifacts: ExecutionArtifact[]
): Promise<void> {
  const projectName = request.projectName ?? path.basename(baseDir);

  await writeFile(
    'generate-config',
    path.join(baseDir, 'src/config/app.ts'),
    await renderSnippet('generate-config.app-config.ts.tpl'),
    request,
    artifacts
  );

  await writeFile(
    'generate-config',
    path.join(baseDir, 'resources/application.yml'),
    await renderSnippet('generate-config.application.yml.tpl', { projectName }),
    request,
    artifacts
  );

  await writeFile(
    'generate-config',
    path.join(baseDir, 'resources/local.yml'),
    await renderSnippet('generate-config.local.yml.tpl'),
    request,
    artifacts
  );
}

async function execGenerateTestSuite(
  baseDir: string,
  request: ExecutionRequest,
  artifacts: ExecutionArtifact[]
): Promise<void> {
  await writeFile(
    'generate-test-suite',
    path.join(baseDir, 'test/unit/example.ts'),
    await renderSnippet('generate-test-suite.unit.ts.tpl'),
    request,
    artifacts
  );

  await writeFile(
    'generate-test-suite',
    path.join(baseDir, 'test/fixtures/example.json'),
    await renderSnippet('generate-test-suite.fixture.json.tpl'),
    request,
    artifacts
  );
}

type OperationHandler = (
  baseDir: string,
  request: ExecutionRequest,
  artifacts: ExecutionArtifact[]
) => Promise<void>;

const OPERATION_HANDLERS: Partial<Record<ExecutionRequest['operations'][number], OperationHandler>> = {
  'project-bootstrap': execProjectBootstrap,
  'create-web-route': execCreateWebRoute,
  'email-create-template': execEmailCreateTemplate,
  'email-context-schema': execEmailContextSchema,
  'email-render-pipeline': execEmailRenderPipeline,
  'email-transport-provider': execEmailTransportProvider,
  'email-preview-snapshot': execEmailPreviewSnapshot,
  'email-send-flow': execEmailSendFlow,
  'email-test-fixtures': execEmailTestFixtures,
  'model-indexed-assistant': execModelIndexedAssistant,
  'model-query-assistant': execModelQueryAssistant,
  'rest-rpc-client': execRestRpcClient,
  'generate-config': execGenerateConfig,
  'generate-test-suite': execGenerateTestSuite
};

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
