import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { RegistryV2 } from '@travetto/registry';
import { Schema } from '@travetto/schema';

@Schema({ subTypeField: 'flavor' })
abstract class CustomBase {
  flavor: string;
  beans: number;
}

@Schema()
class Vanilla extends CustomBase {
  beans = 0;
}

@Schema()
class Chocolate extends CustomBase {
  beans = 10;
}

@Schema()
class ExtraChocolate extends Chocolate {
  beans = 10;
}

@Suite()
class CustomSubtypeSuite {
  @Test()
  async simpleTest() {
    await RegistryV2.init();

    assert(true);

    assert(Vanilla.from({
      beans: 20
    }).flavor === 'vanilla');

    assert(Chocolate.from({
      beans: 20
    }).flavor === 'chocolate');

    assert(ExtraChocolate.from({
      beans: 20
    }).flavor === 'extra_chocolate');

    assert.throws(() => {
      Vanilla.from(
        Chocolate.from({
          beans: 20
        })
      );
    });

    assert(CustomBase.from({
      flavor: 'extra_chocolate',
      beans: 20
    }) instanceof ExtraChocolate);

    assert(CustomBase.from({
      flavor: 'chocolate',
      beans: 20
    }) instanceof Chocolate);

    assert(Chocolate.from({
      flavor: 'chocolate',
      beans: 20
    }) instanceof Chocolate);

    assert(Chocolate.from({
      flavor: 'extra_chocolate',
      beans: 20
    }) instanceof ExtraChocolate);
  }
}