import os from 'node:os';
import fs from 'node:fs/promises';
import assert from 'node:assert';
import path from 'node:path';

import { AfterAll, Suite, Test } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';

import { FetchClientGenerator } from '../src/fetch.ts';
import { AngularClientGenerator } from '../src/angular.ts';

import './sample';

@Suite()
export class SimpleSuite {

  getTempDir(type: string): string {
    return path.resolve(os.tmpdir(), `client${process.pid}`, type);
  }

  @AfterAll()
  async cleanup() {
    await fs.rm(this.getTempDir('.'), { recursive: true, force: true });
  }

  @Test()
  async validateFetch() {
    const root = this.getTempDir('fetch');
    const exists = (file: string) => fs.stat(path.resolve(root, file)).then(() => true, () => false);

    await RootRegistry.init();

    await fs.mkdir(root, { recursive: true });
    await new FetchClientGenerator(root, undefined, { node: true }).render();

    assert(await exists('package.json'));
    assert(JSON.parse(await fs.readFile(path.resolve(root, 'package.json'), 'utf8')).main === 'src/index.ts');
    assert(await exists('src/index.ts'));
    assert(await exists('src/shared/util.ts'));
    assert(await exists('src/shared/types.ts'));
    assert(await exists('src/shared/fetch-service.ts'));
  }

  @Test()
  async validateAngular() {
    const root = this.getTempDir('angular');
    const exists = (file: string) => fs.stat(path.resolve(root, file)).then(() => true, () => false);

    await RootRegistry.init();
    await fs.mkdir(root, { recursive: true });
    await new AngularClientGenerator(root).render();

    assert(!await exists('package.json'));
    assert(await exists('index.ts'));
    assert(await exists('shared/angular-service.ts'));
    assert(await exists('shared/util.ts'));
    assert(await exists('shared/types.ts'));
  }
}