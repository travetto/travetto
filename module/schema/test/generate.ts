import { Suite, Test, BeforeAll } from '@travetto/test';

import { Schema, SchemaRegistry } from '../src';
import { GenerateUtil } from '../support/util.generate';

import * as assert from 'assert';

@Schema()
class Tag {
  id: string;
  name: string;
  createdDate: Date;
}

@Schema()
class Address {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  country: string;
}

@Schema()
class User {
  fName: string;
  lName: string;
  email: string;
  phone: string;
  dob?: Date;

  tags: Tag[];

  address: Address;
}

@Suite()
class DataGenerationSuite {

  @BeforeAll()
  async init() {
    await SchemaRegistry.init();
  }

  @Test()
  verifyValueGen() {
    const user = GenerateUtil.generate(User);

    assert.ok(user);

    assert(user instanceof User);

    assert.ok(user.address);

    assert(user.address instanceof Address);
  }
}