import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';
import { SchemaRegistry, UnknownType } from '@travetto/schema';

import { Unknowable } from './models/unknown.ts';

@Suite()
export class UnknownTest {

  @Test()
  async basic() {
    await RootRegistry.init();
    const config = SchemaRegistry.getViewSchema(Unknowable).schema.value;
    assert(config.type === UnknownType);
  }
}