import assert from 'node:assert';

import { Registry } from '@travetto/registry';
import { SchemaRegistryIndex, UnknownType } from '@travetto/schema';
import { Suite, Test } from '@travetto/test';

import { Unknowable } from './models/unknown.ts';

@Suite()
export class UnknownTest {
  @Test()
  async basic() {
    await Registry.init();
    const fields = SchemaRegistryIndex.get(Unknowable).getFields().value;
    assert(fields.type === UnknownType);
  }
}
