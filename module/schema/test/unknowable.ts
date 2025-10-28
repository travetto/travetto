import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { RegistryV2 } from '@travetto/registry';
import { SchemaRegistryIndex, UnknownType } from '@travetto/schema';

import { Unknowable } from './models/unknown.ts';

@Suite()
export class UnknownTest {

  @Test()
  async basic() {
    await RegistryV2.init();
    const config = SchemaRegistryIndex.get(Unknowable).getView().value;
    assert(config.type === UnknownType);
  }
}