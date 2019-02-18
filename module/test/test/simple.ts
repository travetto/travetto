import { Suite, Test, BeforeAll, AfterEach, AfterAll, BeforeEach } from '../';
import * as assert from 'assert';

let a: any = 0; a = 1;

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
    await new Promise(resolve => setTimeout(resolve, 1000));
    assert(1 === a);
  }

  @Test()
  async validateThrows() {
    assert.throws(() => {
      throw new Error();
    });

    assert.doesNotThrow(() => {
      const c = 5;
    });

    await assert.rejects(async () => {
      throw new Error();
    });

    await assert.doesNotReject(async () => {
      const c = 5;
    });

    assert.throws(() => {
      assert.doesNotThrow(() => {
        throw new Error();
      });
    });

    assert.throws(() => {
      assert.throws(() => {
        const c = 5;
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
    }, (err: any) => {
      return err.message.startsWith('Big') && err.message.length > 4 ? undefined : err;
    });
  }
}