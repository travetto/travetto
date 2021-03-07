import * as assert from 'assert';
// import * as cookies from 'cookies';

import { Suite, Test } from '@travetto/test';
import { Inject } from '@travetto/di';
import { Request, Response } from '@travetto/rest';
import { InjectableSuite } from '@travetto/di/test-support/suite';

import { OpaqueSessionProvider } from '../src/provider/opaque';
import { Session } from '../src/types';
import { SessionConfig } from '../src/config';

@Suite()
@InjectableSuite()
export class EncoderTest {

  @Inject()
  instance: OpaqueSessionProvider;

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
      id: 'true',
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