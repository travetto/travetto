import os from 'os';

import { Suite, Test } from '@travetto/test';
import { path } from '@travetto/manifest';
import { RootRegistry } from '@travetto/registry';
import { ControllerVisitUtil } from '@travetto/rest';

import { AngularClientGenerator } from '../src/provider/angular';

import './sample';

@Suite()
export class SimpleSuite {
  @Test()
  async validateFetch() {
    await RootRegistry.init();

    const gen = new AngularClientGenerator(path.resolve(os.tmpdir(), 'client'));
    await ControllerVisitUtil.visit(gen);
  }
}