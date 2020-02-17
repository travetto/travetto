import * as assert from 'assert';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { Schema } from '../src/decorator/schema';
import { SchemaRegistry } from '../src/service/registry';
import { ALL_VIEW } from '../src/service/types';

interface Address {
  street1: string;
  street2: string;
}

@Schema()
class User {
  address: Address;
}

@Suite()
export class ViewsTest {

  @BeforeAll()
  ready() {
    return SchemaRegistry.init();
  }

  @Test()
  async testWith() {
    assert.throws(() => SchemaRegistry.get(User).views[ALL_VIEW].schema.address.type === Object);
  }
}