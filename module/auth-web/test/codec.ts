import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Inject } from '@travetto/di';
import { HttpResponse } from '@travetto/web';
import { asFull } from '@travetto/runtime';

import { InjectableSuite } from '@travetto/di/support/test/suite.ts';

import { AuthContextInterceptor } from '../src/interceptors/context.ts';
import { JWTPrincipalCodec } from '../src/codec.ts';
import { WebAuthConfig } from '../src/config.ts';
import { CommonPrincipalCodecSymbol } from '../src/types.ts';

@Suite()
@InjectableSuite()
export class CodecTest {

  @Inject()
  interceptor: AuthContextInterceptor;

  @Inject(CommonPrincipalCodecSymbol)
  codec: JWTPrincipalCodec;

  @Inject()
  config: WebAuthConfig;

  @Test()
  async testHeader() {
    const headers: Record<string, string> = {};
    this.interceptor.config.mode = 'header';

    await this.interceptor.codec.encode(
      {
        req: asFull({}),
        res: asFull<HttpResponse>({
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
      res: asFull<HttpResponse>({
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

  @Test()
  async keyRotation() {
    this.interceptor.config.keyMap['orange'] = {
      id: 'orange',
      key: 'green'
    };

    const token = await this.codec.create({
      id: 'bob',
      details: {}
    }, 'orange');

    await assert.doesNotReject(() =>
      this.codec.verify(token)
    );

    await assert.rejects(() =>
      this.codec.create({
        id: 'bob',
        details: {}
      }, 'orange2')
    );

    const token1 = await this.codec.create({
      id: 'bob',
      details: {}
    }, 'orange');

    const token2 = await this.codec.create({
      id: 'bob',
      details: {}
    });

    const sig1 = JSON.parse(Buffer.from(token1.split('.')[0], 'base64').toString('utf8'));
    const sig2 = JSON.parse(Buffer.from(token2.split('.')[0], 'base64').toString('utf8'));
    assert(sig1.kid !== sig2.kid);
    assert(sig1.kid === 'orange');
  }
}