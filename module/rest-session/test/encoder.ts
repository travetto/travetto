import * as assert from 'assert';
import * as cookies from 'cookies';

import { Suite, Test, BeforeEach } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';

import { HeaderEncoder } from '../src/encoder/header';
import { Session } from '../src/types';
import { SessionConfig } from '../src/config';
import { CookieEncoder } from '../src/encoder/cookie';

@Suite()
export class EncoderTest {

  @BeforeEach()
  async init() {
    await DependencyRegistry.init();
  }

  @Test()
  async testSessionHeader() {
    const instance = await DependencyRegistry.getInstance(HeaderEncoder);
    const config = await DependencyRegistry.getInstance(SessionConfig);

    const headers: { [key: string]: any } = {};

    await instance.encode({} as any, {
      setHeader(key: string, value: any) {
        headers[key] = value;
      }
    } as any, new Session({
      id: 'true',
      data: {
        data: 'hello'
      }
    }));

    assert(headers[config.keyName] !== undefined);
  }

  @Test()
  async testSessionHeaderMissing() {
    const instance = await DependencyRegistry.getInstance(HeaderEncoder);
    const config = await DependencyRegistry.getInstance(SessionConfig);

    const headers: { [key: string]: any } = {};

    await instance.encode({} as any, {
      setHeader(key: string, value: any) {
        headers[key] = value;
      }
    } as any, null);

    assert(headers[config.keyName] === undefined);
  }
}