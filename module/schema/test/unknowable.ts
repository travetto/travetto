import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Registry } from '@travetto/registry';
import { SchemaRegistryIndex, UnknownType } from '@travetto/schema';

import { Unknowable } from './models/unknown.ts';

@Suite()
export class UnknownTest {

  @Test()
  async basic() {
    await Registry.init();
    const fields = SchemaRegistryIndex.getFieldMap(Unknowable).value;
    assert(fields.type === UnknownType);
  }
}