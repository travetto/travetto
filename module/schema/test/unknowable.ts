import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';

import { Unknowable } from './models/unknown';
import { SchemaRegistry } from '../src/service/registry';
import { UnknownType } from '../src/types';

@Suite()
export class UnknownTest {

  @Test()
  async basic() {
    await RootRegistry.init();
    const config = SchemaRegistry.getViewSchema(Unknowable).schema.value;
    assert(config.type === UnknownType);
  }
}