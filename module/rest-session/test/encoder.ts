import * as assert from 'assert';
// import * as cookies from 'cookies';

import { RootRegistry } from '@travetto/registry';
import { Suite, Test, BeforeEach } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';
import { Request, Response } from '@travetto/rest';

import { RequetSessionEncoder } from '../src/encoder/request';
import { Session } from '../src/types';
import { SessionConfig } from '../src/config';
// import { CookieEncoder } from '../src/encoder/cookie';

@Suite()
export class EncoderTest {

  @BeforeEach()
  async init() {
    await RootRegistry.init();
  }

  @Test()
  async testSessionHeader() {
    const instance = await DependencyRegistry.getInstance(RequetSessionEncoder);
    const config = await DependencyRegistry.getInstance(SessionConfig);
    config.transport = 'header';

    const headers: Record<string, string> = {};

    await instance.encode({} as Request, {
      setHeader(key: string, value: string) {
        headers[key] = value;
      }
    } as Response, new Session({
      key: 'true',
      data: {
        data: 'hello'
      }
    }));

    assert(headers[config.keyName] !== undefined);
  }

  @Test()
  async testSessionHeaderMissing() {
    const instance = await DependencyRegistry.getInstance(RequetSessionEncoder);
    const config = await DependencyRegistry.getInstance(SessionConfig);
    config.transport = 'header';

    const headers: Record<string, string> = {};

    await instance.encode({} as Request, {
      setHeader(key: string, value: string) {
        headers[key] = value;
      }
    } as Response, null);

    assert(headers[config.keyName] === undefined);
  }
}