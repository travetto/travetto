import { Suite, Test, BeforeAll, AfterEach, AfterAll, BeforeEach } from '../';
import * as assert from 'assert';

let a: unknown = 0; a = 1;

const BIG = { age: 5 };
const BIGGER: object = { age: 6 };

class Alt {
  includes(o: unknown): boolean {
    return true;
  }
  test(o: unknown): boolean {
    return true;
  }
}

@Suite()
class Simple {

  @BeforeAll()
  initAll() {
    console.debug('b4-all');
  }

  @BeforeEach()
  initEach() {
    console.debug('b4-each');
  }

  @AfterAll()
  deinitAll() {
    console.debug('aft-all');
  }

  @AfterEach()
  deinitEach() {
    console.debug('aft-each');
  }

  @Test()
  test1a() {
    console.log('howdy');
    assert(1 === 1);
  }

  @Test()
  test1b() {
    assert(1 === 1);
  }

  @Test()
  test1c() {
    assert(1 === 1);
  }

  @Test()
  async test1d() {
    await new Promise(resolve => setTimeout(resolve, 100));
    assert(1 === a);
  }

  @Test()
  async validateThrows() {
    assert.throws(() => {
      throw new Error();
    });

    assert.doesNotThrow(() => {
      const c = 5;
      console.log('Success', { value: c });
    });

    await assert.rejects(async () => {
      throw new Error();
    });

    await assert.doesNotReject(async () => {
      const c = 5;
      console.log('Success', { value: c });
    });

    assert.throws(() => {
      assert.doesNotThrow(() => {
        throw new Error();
      });
    });

    assert.throws(() => {
      assert.throws(() => {
        const c = 5;
        console.log('Success', { value: c });
      });
    });

    await assert.rejects(async () => {
      await assert.doesNotReject(async () => {
        throw new Error();
      });
    });
    await assert.rejects(async () => {
      await assert.rejects(async () => {
        const c = 5;
        console.log('Success', { value: c });
      });
    });
  }

  @Test()
  asyncErrorChecking() {
    assert.throws(() => {
      throw new Error('Big Error');
    }, 'Big Error');

    assert.throws(() => {
      throw new Error('Big Error');
    }, /B.*Error/);

    assert.throws(() => {
      throw new Error('Big Error');
    }, Error);

    assert.throws(() => {
      throw new Error('Big Error');
    }, (err: Error) =>
      err.message.startsWith('Big') && err.message.length > 4 ? undefined : err
    );
  }

  @Test()
  testTypes() {
    const op = () => [1, 2, 3];

    assert([1, 2, 3].includes(3));
    assert(/[abc]/.test('a'));

    assert(op().includes(3));

    const alt = new Alt();
    assert(alt.includes(3));
    assert(alt.test('a'));
  }

  @Test()
  testConstVerification() {
    const c = { name: 20 };
    const d = { name: 20 };

    assert(c === d);
  }
}