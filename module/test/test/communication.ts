import assert from 'node:assert';

import { Test, Suite } from '@travetto/test';
import { AppError } from '@travetto/runtime';

import { CommunicationUtil } from '../src/communication.ts';

@Suite()
export class CommunicationUtilTest {

  @Test()
  async verifySerialize() {
    const payload = {
      err: new AppError('Uh-oh'),
      count: 2000n
    };

    const plain = CommunicationUtil.serializeToObject(payload);
    assert(typeof plain === 'object');
    assert(plain);
    assert('err' in plain);
    assert(typeof plain.err === 'object');
    assert(plain.err);
    assert('$' in plain.err);
    assert('stack' in plain.err);
    assert(typeof plain.err.stack === 'string');

    console.error(plain);

    const complex: typeof payload = CommunicationUtil.deserializeFromObject(plain);

    assert(complex.err instanceof AppError);
    assert(complex.err.stack === payload.err.stack);
    assert(typeof complex.count === 'bigint');
  }
}