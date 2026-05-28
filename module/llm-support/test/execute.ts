import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { SchemaValidator } from '@travetto/schema';
import { Suite, Test } from '@travetto/test';
import { FileLoader, JSONUtil, RuntimeResources } from '@travetto/runtime';

import { executeOperations, getUnimplementedOperations } from '../src/execute.ts';
import { recommendOperations } from '../src/recommendation.ts';
import { PackageJsonSchema } from '../src/template-shapes.ts';

async function readSnippet(name: string): Promise<string> {
  return RuntimeResources.readUTF8(`snippets/code/${name}`);
}

async function renderSnippet(name: string, params: Record<string, string> = {}): Promise<string> {
  const source = await readSnippet(name);
  return source.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_all, key: string) => params[key] ?? '');
}

type TargetContext = {
  target: string;
  loader: FileLoader;
};

async function createTarget(prefix: string): Promise<TargetContext> {
  const target = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  return { target, loader: new FileLoader([target]) };
}

async function assertFilesExist(loader: FileLoader, files: string[]): Promise<void> {
  for (const file of files) {
    await loader.resolve(file);
  }
}

@Suite()
class LlmSupportExecuteTest {

  @Test()
  async dryRunDoesNotCreateFiles() {
    const { target, loader } = await createTarget('llm-support-dry-run-');

    const output = await executeOperations({
      operations: ['project-bootstrap'],
      targetDir: target,
      dryRun: true
    });

    assert(output.artifacts.some(item => item.status === 'planned'));
    assert(output.artifacts.some(item => item.file.endsWith('package.json')));

    await assert.rejects(
      () => loader.resolve('resources/application.yml'),
      /Unable to find/
    );

    await assert.rejects(
      () => loader.resolve('package.json'),
      /Unable to find/
    );
  }

  @Test()
  async projectBootstrapCreatesPackageAndCoreFiles() {
    const { target, loader } = await createTarget('llm-support-bootstrap-');

    const output = await executeOperations({
      operations: ['project-bootstrap'],
      targetDir: target,
      dryRun: false,
      projectName: 'sample-bootstrap-app'
    });

    assert(output.artifacts.some(item => item.status === 'created'));

    await assertFilesExist(loader, [
      'package.json',
      'resources/application.yml',
      'src/service/home.ts',
      'src/web/home.ts'
    ]);

    const pkgRaw: {
      name?: string;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    } = JSONUtil.fromUTF8(await loader.readUTF8('package.json'));

    assert(pkgRaw.name === 'sample-bootstrap-app');
    assert(pkgRaw.scripts?.start === 'trv web:http');
    assert(pkgRaw.scripts?.test === 'trv test');
    assert(pkgRaw.dependencies?.['@travetto/web']);
    assert(pkgRaw.dependencies?.['@travetto/web-http']);
    assert(pkgRaw.dependencies?.['@travetto/di']);
    assert(pkgRaw.devDependencies?.['@travetto/cli']);
    assert(pkgRaw.devDependencies?.['@travetto/compiler']);
  }

  @Test()
  async projectBootstrapCreatesMonorepoLayout() {
    const { target, loader } = await createTarget('llm-support-bootstrap-mono-');

    const output = await executeOperations({
      operations: ['project-bootstrap'],
      targetDir: target,
      dryRun: false,
      projectName: 'sample-mono-app',
      monorepo: true
    });

    assert(output.artifacts.some(item => item.status === 'created'));

    await assertFilesExist(loader, [
      'package.json',
      'packages/app/package.json',
      'packages/app/resources/application.yml',
      'packages/app/src/service/home.ts',
      'packages/app/src/web/home.ts'
    ]);

    const rootPkgRaw: {
      name?: string;
      workspaces?: string[];
      scripts?: Record<string, string>;
    } = JSONUtil.fromUTF8(await loader.readUTF8('package.json'));
    const appPkgRaw: {
      name?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    } = JSONUtil.fromUTF8(await loader.readUTF8('packages/app/package.json'));

    assert(rootPkgRaw.name === 'sample-mono-app');
    assert(rootPkgRaw.workspaces?.includes('packages/*'));
    assert(rootPkgRaw.scripts?.start === 'npm run -w sample-mono-app-app start');
    assert(rootPkgRaw.scripts?.test === 'npm run -w sample-mono-app-app test');

    assert(appPkgRaw.name === 'sample-mono-app-app');
    assert(appPkgRaw.dependencies?.['@travetto/web']);
    assert(appPkgRaw.dependencies?.['@travetto/web-http']);
    assert(appPkgRaw.devDependencies?.['@travetto/cli']);
  }

  @Test()
  async projectBootstrapSupportsCustomMonorepoWorkspace() {
    const { target, loader } = await createTarget('llm-support-bootstrap-mono-custom-');

    const output = await executeOperations({
      operations: ['project-bootstrap'],
      targetDir: target,
      dryRun: false,
      projectName: 'sample-mono-custom',
      monorepo: true,
      workspacePath: 'packages/api',
      workspaceName: 'sample-mono-workspace'
    });

    assert(output.artifacts.some(item => item.status === 'created'));

    await assertFilesExist(loader, [
      'package.json',
      'packages/api/package.json',
      'packages/api/resources/application.yml'
    ]);

    const rootPkgRaw: {
      scripts?: Record<string, string>;
    } = JSONUtil.fromUTF8(await loader.readUTF8('package.json'));
    const appPkgRaw: {
      name?: string;
    } = JSONUtil.fromUTF8(await loader.readUTF8('packages/api/package.json'));

    assert(rootPkgRaw.scripts?.start === 'npm run -w sample-mono-workspace start');
    assert(rootPkgRaw.scripts?.test === 'npm run -w sample-mono-workspace test');
    assert(appPkgRaw.name === 'sample-mono-workspace');
  }

  @Test()
  async applyCreatesFiles() {
    const { target, loader } = await createTarget('llm-support-apply-');

    const output = await executeOperations({
      operations: ['create-web-route'],
      targetDir: target,
      dryRun: false,
      routePath: 'orders',
      serviceName: 'OrderService',
      controllerName: 'OrderController'
    });

    assert(output.artifacts.some(item => item.status === 'created'));
    assert(output.artifacts.some(item => item.stepId === 'generate-artifacts'));
    await assertFilesExist(loader, ['src/service/order.ts', 'src/web/order.ts']);

    const expectedService = await renderSnippet('create-web-route.service.ts.tpl', {
      serviceName: 'OrderService'
    });
    const expectedController = await renderSnippet('create-web-route.controller.ts.tpl', {
      serviceName: 'OrderService',
      serviceFile: 'order',
      routePath: 'orders',
      controllerName: 'OrderController'
    });

    assert((await loader.readUTF8('src/service/order.ts')) === expectedService);
    assert((await loader.readUTF8('src/web/order.ts')) === expectedController);
  }

  @Test()
  async warnsOnUnknownOperation() {
    const target = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-support-unknown-'));

    const output = await executeOperations({
      operations: ['unknown-op'],
      targetDir: target,
      dryRun: true
    });

    assert(output.warnings.length === 1);
    assert(output.warnings[0].includes('unknown-op'));
  }

  @Test()
  async applyCreatesEmailArtifacts() {
    const { target, loader } = await createTarget('llm-support-email-');

    const output = await executeOperations({
      operations: [
        'email-create-template',
        'email-context-schema',
        'email-render-pipeline',
        'email-transport-provider',
        'email-preview-snapshot',
        'email-send-flow',
        'email-test-fixtures'
      ],
      targetDir: target,
      dryRun: false,
      emailName: 'welcome',
      sendRoutePath: 'mail/send'
    });

    assert(output.artifacts.some(item => item.status === 'created'));
    await assertFilesExist(loader, [
      'src/email/templates/welcome.mustache',
      'src/email/schema.ts',
      'src/email/render.ts',
      'src/email/provider.ts',
      'src/config/email.ts',
      'src/web/email.ts',
      'test/email/preview.ts',
      'test/email/fixtures/transactional.json'
    ]);
    assert((await loader.readUTF8('test/email/fixtures/transactional.json')) === await renderSnippet('email-fixture.json.tpl'));
  }

  @Test()
  async applyCreatesModelArtifacts() {
    const { target, loader } = await createTarget('llm-support-model-');

    const output = await executeOperations({
      operations: ['model-indexed-assistant', 'model-query-assistant'],
      targetDir: target,
      dryRun: false,
      modelName: 'OrderItem'
    });

    assert(output.artifacts.some(item => item.status === 'created'));
    await assertFilesExist(loader, [
      'src/model/order-item.ts',
      'src/model/order-item.indexes.ts',
      'src/service/order-item-indexed.ts',
      'src/service/order-item-query.ts'
    ]);
  }

  @Test()
  async applyCreatesAdditionalCoreArtifacts() {
    const { target, loader } = await createTarget('llm-support-core-');

    const output = await executeOperations({
      operations: ['rest-rpc-client', 'generate-config', 'generate-test-suite'],
      targetDir: target,
      dryRun: false,
      routePath: 'orders',
      projectName: 'support-app'
    });

    assert(output.artifacts.some(item => item.status === 'created'));
    await assertFilesExist(loader, [
      'src/client/orders.ts',
      'src/client/index.ts',
      'src/config/app.ts',
      'resources/application.yml',
      'resources/local.yml',
      'test/unit/example.ts',
      'test/fixtures/example.json'
    ]);
  }

  @Test()
  async applyCreatesWorkflowAndPlatformArtifacts() {
    const { target, loader } = await createTarget('llm-support-platform-');

    const output = await executeOperations({
      operations: [
        'workflow-gcp-deploy',
        'workflow-cloudfront-deploy',
        'create-web-interceptor',
        'cache-enhancements'
      ],
      targetDir: target,
      dryRun: false
    });

    assert(output.artifacts.some(item => item.status === 'created'));
    await assertFilesExist(loader, [
      '.github/workflows/deploy-api.yml',
      '.github/workflows/deploy-ui.yml',
      'src/interceptor/request-logging.ts',
      'src/service/cacheable.ts',
      'src/config/cache.ts'
    ]);
  }

  @Test()
  async applyCreatesReleasePipelineArtifacts() {
    const { target, loader } = await createTarget('llm-support-release-');

    const output = await executeOperations({
      operations: [
        'openapi-spec-pipeline',
        'openapi-client-generation',
        'aws-lambda-package-and-deploy',
        'pack-docker-release',
        'repo-version-release'
      ],
      targetDir: target,
      dryRun: false
    });

    assert(output.artifacts.some(item => item.status === 'created'));
    await assertFilesExist(loader, [
      '.github/workflows/openapi-spec.yml',
      '.github/workflows/openapi-client.yml',
      '.github/workflows/deploy-lambda.yml',
      '.github/workflows/docker-release.yml',
      '.github/workflows/repo-version-release.yml',
      'src/client/README.md'
    ]);
  }

  @Test()
  async statusShowsRemainingUnimplemented() {
    const missing = getUnimplementedOperations([
      'workflow-gcp-deploy',
      'workflow-cloudfront-deploy',
      'create-web-interceptor',
      'cache-enhancements',
      'enable-file-upload',
      'enable-auth-session',
      'enable-linting',
      'excluded-log-config'
    ]);

    assert(!missing.includes('workflow-gcp-deploy'));
    assert(!missing.includes('workflow-cloudfront-deploy'));
    assert(!missing.includes('create-web-interceptor'));
    assert(!missing.includes('cache-enhancements'));
    assert(!missing.includes('enable-file-upload'));
    assert(!missing.includes('enable-auth-session'));
    assert(!missing.includes('enable-linting'));
    assert(missing.includes('excluded-log-config'));
  }

  @Test()
  async allNonExcludedOperationsImplemented() {
    const ids = recommendOperations({ includeExcluded: false }).map(item => item.id);
    const missing = getUnimplementedOperations(ids);

    assert(missing.length === 0);
  }

  @Test()
  async applyCreatesAuthUploadLintArtifacts() {
    const { target, loader } = await createTarget('llm-support-auth-upload-lint-');

    const output = await executeOperations({
      operations: ['enable-file-upload', 'enable-auth-session', 'enable-linting'],
      targetDir: target,
      dryRun: false
    });

    assert(output.artifacts.some(item => item.status === 'created'));
    await assertFilesExist(loader, [
      'src/web/upload.ts',
      'src/config/upload.ts',
      'src/web/auth.ts',
      'src/web/auth.config.ts',
      'package.json'
    ]);

    const pkg = await loader.readUTF8('package.json');
    assert(pkg.includes('trv eslint:register'));
  }

  @Test()
  async enableLintingMergesPackageJson() {
    const { target, loader } = await createTarget('llm-support-lint-merge-');
    const pkgFile = path.join(target, 'package.json');

    await fs.writeFile(pkgFile, JSONUtil.toUTF8({
      name: 'existing-app',
      scripts: {
        test: 'node --test',
        lint: 'eslint .'
      },
      devDependencies: {
        typescript: '^5.0.0'
      }
    }, { indent: 2 }));

    await executeOperations({
      operations: ['enable-linting'],
      targetDir: target,
      dryRun: false
    });

    const raw: PackageJsonSchema = JSONUtil.fromUTF8(await loader.readUTF8('package.json'));
    const merged = PackageJsonSchema.from(raw);
    await SchemaValidator.validate(PackageJsonSchema, merged);

    assert(merged.scripts?.test === 'node --test');
    assert(merged.scripts?.lint === 'eslint .');
    assert(merged.scripts?.['lint:register'] === 'trv eslint:register');
    assert(merged.devDependencies?.typescript === '^5.0.0');
    assert(Boolean(merged.devDependencies?.['@travetto/eslint']));
  }
}
