import os from 'os';
import fs from 'fs/promises';
import assert from 'assert';

import { AfterAll, Suite, Test } from '@travetto/test';
import { path } from '@travetto/manifest';
import { RootRegistry } from '@travetto/registry';
import { DependencyRegistry } from '@travetto/di';


import { RestClientGeneratorService } from '../src/service';
import { FetchClientGenerator } from '../src/provider/fetch';
import { AngularClientGenerator } from '../src/provider/angular';

import './sample';

@Suite()
export class SimpleSuite {

  getTempDir(type: string): string {
    return path.resolve(os.tmpdir(), `client${process.pid}`, type);
  }

  @AfterAll()
  async cleanup() {
    await fs.rm(this.getTempDir('.'), { recursive: true });
  }

  @Test()
  async validateFetch() {
    const root = this.getTempDir('fetch');
    const exists = (file: string) => fs.stat(path.resolve(root, file)).then(() => true, () => false);

    await RootRegistry.init();
    const svc = await DependencyRegistry.getInstance(RestClientGeneratorService);

    await fs.mkdir(root, { recursive: true });
    const gen = new FetchClientGenerator(root);
    await svc.renderProvider(gen);

    assert(await exists('package.json'));
    assert(JSON.parse(await fs.readFile(path.resolve(root, 'package.json'), 'utf8')).main === 'src/index.ts');
    assert(await exists('src/index.ts'));
    assert(await exists('src/base-service.ts'));
    assert(await exists('src/utils.ts'));
    assert(await exists('src/common.ts'));
  }

  @Test()
  async validateAngular() {
    const root = this.getTempDir('angular');
    const exists = (file: string) => fs.stat(path.resolve(root, file)).then(() => true, () => false);

    await RootRegistry.init();
    const svc = await DependencyRegistry.getInstance(RestClientGeneratorService);

    await fs.mkdir(root, { recursive: true });
    const gen = new AngularClientGenerator(root);
    await svc.renderProvider(gen);

    assert(!await exists('package.json'));
    assert(await exists('index.ts'));
    assert(await exists('base-service.ts'));
    assert(await exists('utils.ts'));
    assert(await exists('common.ts'));
  }
}