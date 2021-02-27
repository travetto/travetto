import * as assert from 'assert';
// import * as cookies from 'cookies';

import { Suite, Test } from '@travetto/test';
import { Inject } from '@travetto/di';
import { Request, Response } from '@travetto/rest';
import { InjectableSuite } from '@travetto/di/test-support/suite';

import { RequetSessionEncoder } from '../src/encoder/request';
import { Session } from '../src/types';
import { SessionConfig } from '../src/config';
// import { CookieEncoder } from '../src/encoder/cookie';

@Suite()
@InjectableSuite()
export class EncoderTest {

  @Inject()
  instance: RequetSessionEncoder;

  @Inject()
  config: SessionConfig;

  @Test()
  async testSessionHeader() {
    this.config.transport = 'header';

    const headers: Record<string, string> = {};

    await this.instance.encode({} as Request, {
      setHeader(key: string, value: string) {
        headers[key] = value;
      }
    } as Response, new Session({
      key: 'true',
      data: {
        data: 'hello'
      }
    }));

    assert(headers[this.config.keyName] !== undefined);
  }

  @Test()
  async testSessionHeaderMissing() {
    this.config.transport = 'header';

    const headers: Record<string, string> = {};

    await this.instance.encode({} as Request, {
      setHeader(key: string, value: string) {
        headers[key] = value;
      }
    } as Response, null);

    assert(headers[this.config.keyName] === undefined);
  }
}