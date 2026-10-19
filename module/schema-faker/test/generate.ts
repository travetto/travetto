import assert from 'node:assert';

import { Registry } from '@travetto/registry';
import { CommonRegex, Field, Max, Min, Precision, Schema, Uuid } from '@travetto/schema';
import { SchemaFaker } from '@travetto/schema-faker';
import { BeforeAll, Suite, Test } from '@travetto/test';

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

@Schema()
class CustomGeneratorClass {
  @Field({ generator: () => 'custom-mocked-value' })
  customField: string;
}

@Schema()
class UuidClass {
  @Uuid()
  uuidField: string;
}

@Suite()
class DataGenerationSuite {
  @BeforeAll()
  async init() {
    await Registry.init();
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
    const scoreText = `${user.score}`;
    assert(!scoreText.includes('.') || scoreText.split('.')[1].length < 3);
  }

  @Test('Verify field custom generator')
  verifyCustomGenerator() {
    const instance = SchemaFaker.generate(CustomGeneratorClass);
    assert(instance.customField === 'custom-mocked-value');
  }

  @Test('Verify UUID generator')
  verifyUuidGenerator() {
    const instance = SchemaFaker.generate(UuidClass);
    assert(typeof instance.uuidField === 'string');
    assert(instance.uuidField.length === 32);
    assert(CommonRegex.uuid.test(instance.uuidField));
  }
}
