import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Inject } from '@travetto/di';
import { Response } from '@travetto/rest';
import { InjectableSuite } from '@travetto/di/support/test/suite';
import { asFull } from '@travetto/runtime';

import { AuthReadWriteInterceptor } from '../src/interceptors/read-write';

@Suite()
@InjectableSuite()
export class EncoderTest {

  @Inject()
  interceptor: AuthReadWriteInterceptor;

  @Test()
  async testHeader() {
    const headers: Record<string, string> = {};
    this.interceptor.config.mode = 'header';

    await this.interceptor.codec.encode(
      {
        req: asFull({}),
        res: asFull<Response>({
          setHeader(key: string, value: string) {
            headers[key] = value;
          },
          removeHeader(key: string) {
            delete headers[key];
          }
        }),
        config: {}
      },
      {
        id: 'true',
        details: {
          data: 'hello'
        }
      }
    );

    assert(headers.Authorization !== undefined);
  }

  @Test()
  async testHeaderMissing() {
    const headers: Record<string, string> = {};
    this.interceptor.config.mode = 'header';

    await this.interceptor.codec.encode({
      req: asFull({}),
      res: asFull<Response>({
        setHeader(key: string, value: string) {
          headers[key] = value;
        },
        removeHeader(key: string) {
          delete headers[key];
        }
      }),
      config: {}
    }, undefined);

    assert(headers.Authorization === undefined);
  }
}