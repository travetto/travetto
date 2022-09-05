import * as assert from 'assert';

import { RootRegistry } from '@travetto/registry';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { Precision, Max, Min, Schema } from '@travetto/schema';

import { SchemaFaker } from '../src/faker';

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

@Schema()
class UserScore {
  grade: string;

  @Precision(3, 2)
  @Max(100)
  @Min(-10)
  score: number;
}

@Suite()
class DataGenerationSuite {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  @Test()
  verifyValueGen() {
    const user = SchemaFaker.generate(User);

    assert.ok(user);

    assert(user instanceof User);

    assert.ok(user.address);

    assert(user.address instanceof Address);
  }

  @Test()
  verifyNumberGen() {
    const user = SchemaFaker.generate(UserScore);
    assert(user.score >= -10);
    assert(user.score <= 100);
    assert(`${user.score}`.split('.')[1].length < 3);
  }
}