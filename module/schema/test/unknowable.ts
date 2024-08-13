import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Unknowable } from './models/unknown';
import { SchemaRegistry } from '../__index__';
import { UnknownType } from '../src/internal/types';
import { RootRegistry } from '@travetto/registry';

@Suite()
export class UnknownTest {

  @Test()
  async basic() {
    await RootRegistry.init();
    assert(SchemaRegistry.getViewSchema(Unknowable).schema.value.type === UnknownType);
  }
}