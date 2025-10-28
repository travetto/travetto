import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { RegistryV2, RootRegistry } from '@travetto/registry';
import { SchemaRegistryIndex, UnknownType } from '@travetto/schema';

import { Unknowable } from './models/unknown.ts';

@Suite()
export class UnknownTest {

  @Test()
  async basic() {
    await RootRegistry.init();
    const config = RegistryV2.get(SchemaRegistryIndex, Unknowable).getView().value;
    assert(config.type === UnknownType);
  }
}