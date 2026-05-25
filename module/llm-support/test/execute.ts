import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { SchemaValidator } from '@travetto/schema';
import { Suite, Test } from '@travetto/test';
import { JSONUtil, RuntimeResources } from '@travetto/runtime';

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

@Suite()
class LlmSupportExecuteTest {

  @Test()
  async dryRunDoesNotCreateFiles() {
    const target = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-support-dry-run-'));

    const output = await executeOperations({
      operations: ['project-bootstrap'],
      targetDir: target,
      dryRun: true
    });

    assert(output.artifacts.some(item => item.status === 'planned'));
    assert(output.artifacts.some(item => item.file.endsWith('package.json')));

    await assert.rejects(
      () => fs.access(path.join(target, 'resources/application.yml')),
      /ENOENT/
    );

    await assert.rejects(
      () => fs.access(path.join(target, 'package.json')),
      /ENOENT/
    );
  }

  @Test()
  async projectBootstrapCreatesPackageAndCoreFiles() {
    const target = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-support-bootstrap-'));

    const output = await executeOperations({
      operations: ['project-bootstrap'],
      targetDir: target,
      dryRun: false,
      projectName: 'sample-bootstrap-app'
    });

    assert(output.artifacts.some(item => item.status === 'created'));

    const pkgFile = path.join(target, 'package.json');
    const appConfigFile = path.join(target, 'resources/application.yml');
    const serviceFile = path.join(target, 'src/service/home.ts');
    const controllerFile = path.join(target, 'src/web/home.ts');

    await fs.access(pkgFile);
    await fs.access(appConfigFile);
    await fs.access(serviceFile);
    await fs.access(controllerFile);

    const pkgRaw = JSON.parse(await fs.readFile(pkgFile, 'utf8')) as {
      name?: string;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

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
    const target = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-support-bootstrap-mono-'));

    const output = await executeOperations({
      operations: ['project-bootstrap'],
      targetDir: target,
      dryRun: false,
      projectName: 'sample-mono-app',
      monorepo: true
    });

    assert(output.artifacts.some(item => item.status === 'created'));

    const rootPkgFile = path.join(target, 'package.json');
    const appPkgFile = path.join(target, 'packages/app/package.json');
    const appConfigFile = path.join(target, 'packages/app/resources/application.yml');
    const serviceFile = path.join(target, 'packages/app/src/service/home.ts');
    const controllerFile = path.join(target, 'packages/app/src/web/home.ts');

    await fs.access(rootPkgFile);
    await fs.access(appPkgFile);
    await fs.access(appConfigFile);
    await fs.access(serviceFile);
    await fs.access(controllerFile);

    const rootPkgRaw = JSON.parse(await fs.readFile(rootPkgFile, 'utf8')) as {
      name?: string;
      workspaces?: string[];
      scripts?: Record<string, string>;
    };
    const appPkgRaw = JSON.parse(await fs.readFile(appPkgFile, 'utf8')) as {
      name?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

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
  async applyCreatesFiles() {
    const target = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-support-apply-'));

    const output = await executeOperations({
      operations: ['create-web-route'],
      targetDir: target,
      dryRun: false,
      routePath: 'orders',
      serviceName: 'OrderService',
      controllerName: 'OrderController'
    });

    assert(output.artifacts.some(item => item.status === 'created'));
    const serviceFile = path.join(target, 'src/service/order.ts');
    const controllerFile = path.join(target, 'src/web/order.ts');

    await fs.access(serviceFile);
    await fs.access(controllerFile);

    const expectedService = await renderSnippet('create-web-route.service.ts.tpl', {
      serviceName: 'OrderService'
    });
    const expectedController = await renderSnippet('create-web-route.controller.ts.tpl', {
      serviceName: 'OrderService',
      serviceFile: 'order',
      routePath: 'orders',
      controllerName: 'OrderController'
    });

    assert((await fs.readFile(serviceFile, 'utf8')) === expectedService);
    assert((await fs.readFile(controllerFile, 'utf8')) === expectedController);
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
    const target = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-support-email-'));

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
    await fs.access(path.join(target, 'src/email/templates/welcome.mustache'));
    await fs.access(path.join(target, 'src/email/schema.ts'));
    await fs.access(path.join(target, 'src/email/render.ts'));
    await fs.access(path.join(target, 'src/email/provider.ts'));
    await fs.access(path.join(target, 'src/config/email.ts'));
    await fs.access(path.join(target, 'src/web/email.ts'));
    await fs.access(path.join(target, 'test/email/preview.ts'));

    const fixtureFile = path.join(target, 'test/email/fixtures/transactional.json');
    await fs.access(fixtureFile);
    assert((await fs.readFile(fixtureFile, 'utf8')) === await renderSnippet('email-fixture.json.tpl'));
  }

  @Test()
  async applyCreatesModelArtifacts() {
    const target = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-support-model-'));

    const output = await executeOperations({
      operations: ['model-indexed-assistant', 'model-query-assistant'],
      targetDir: target,
      dryRun: false,
      modelName: 'OrderItem'
    });

    assert(output.artifacts.some(item => item.status === 'created'));
    await fs.access(path.join(target, 'src/model/order-item.ts'));
    await fs.access(path.join(target, 'src/model/order-item.indexes.ts'));
    await fs.access(path.join(target, 'src/service/order-item-indexed.ts'));
    await fs.access(path.join(target, 'src/service/order-item-query.ts'));
  }

  @Test()
  async applyCreatesAdditionalCoreArtifacts() {
    const target = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-support-core-'));

    const output = await executeOperations({
      operations: ['rest-rpc-client', 'generate-config', 'generate-test-suite'],
      targetDir: target,
      dryRun: false,
      routePath: 'orders',
      projectName: 'support-app'
    });

    assert(output.artifacts.some(item => item.status === 'created'));
    await fs.access(path.join(target, 'src/client/orders.ts'));
    await fs.access(path.join(target, 'src/client/index.ts'));
    await fs.access(path.join(target, 'src/config/app.ts'));
    await fs.access(path.join(target, 'resources/application.yml'));
    await fs.access(path.join(target, 'resources/local.yml'));
    await fs.access(path.join(target, 'test/unit/example.ts'));
    await fs.access(path.join(target, 'test/fixtures/example.json'));
  }

  @Test()
  async applyCreatesWorkflowAndPlatformArtifacts() {
    const target = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-support-platform-'));

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
    await fs.access(path.join(target, '.github/workflows/deploy-api.yml'));
    await fs.access(path.join(target, '.github/workflows/deploy-ui.yml'));
    await fs.access(path.join(target, 'src/interceptor/request-logging.ts'));
    await fs.access(path.join(target, 'src/service/cacheable.ts'));
    await fs.access(path.join(target, 'src/config/cache.ts'));
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
    const target = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-support-auth-upload-lint-'));

    const output = await executeOperations({
      operations: ['enable-file-upload', 'enable-auth-session', 'enable-linting'],
      targetDir: target,
      dryRun: false
    });

    assert(output.artifacts.some(item => item.status === 'created'));
    await fs.access(path.join(target, 'src/web/upload.ts'));
    await fs.access(path.join(target, 'src/config/upload.ts'));
    await fs.access(path.join(target, 'src/web/auth.ts'));
    await fs.access(path.join(target, 'src/web/auth.config.ts'));
    await fs.access(path.join(target, 'package.json'));

    const pkg = await fs.readFile(path.join(target, 'package.json'), 'utf8');
    assert(pkg.includes('trv eslint:register'));
  }

  @Test()
  async enableLintingMergesPackageJson() {
    const target = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-support-lint-merge-'));
    const pkgFile = path.join(target, 'package.json');

    await fs.writeFile(pkgFile, JSON.stringify({
      name: 'existing-app',
      scripts: {
        test: 'node --test',
        lint: 'eslint .'
      },
      devDependencies: {
        typescript: '^5.0.0'
      }
    }, null, 2));

    await executeOperations({
      operations: ['enable-linting'],
      targetDir: target,
      dryRun: false
    });

    const raw: PackageJsonSchema = JSONUtil.fromUTF8(await fs.readFile(pkgFile, 'utf8'));
    const merged = PackageJsonSchema.from(raw);
    await SchemaValidator.validate(PackageJsonSchema, merged);

    assert(merged.scripts?.test === 'node --test');
    assert(merged.scripts?.lint === 'eslint .');
    assert(merged.scripts?.['lint:register'] === 'trv eslint:register');
    assert(merged.devDependencies?.typescript === '^5.0.0');
    assert(Boolean(merged.devDependencies?.['@travetto/eslint']));
  }
}
