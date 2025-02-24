import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';

import { Unknowable } from './models/unknown.ts';
import { SchemaRegistry } from '../src/service/registry.ts';
import { UnknownType } from '../src/internal/types.ts';

@Suite()
export class UnknownTest {

  @Test()
  async basic() {
    await RootRegistry.init();
    assert(SchemaRegistry.getViewSchema(Unknowable).schema.value.type === UnknownType);
  }
}