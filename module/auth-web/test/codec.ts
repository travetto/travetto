import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Inject } from '@travetto/di';
import { WebResponse } from '@travetto/web';
import { AuthContextInterceptor, CommonPrincipalCodecSymbol, JWTPrincipalCodec, WebAuthConfig } from '@travetto/auth-web';

import { InjectableSuite } from '@travetto/di/support/test/suite.ts';


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
    const response = new WebResponse();
    this.interceptor.config.mode = 'header';

    await this.interceptor.codec.encode(response,
      {
        id: 'true',
        details: {
          data: 'hello'
        }
      }
    );

    assert(response.headers.has('Authorization'));
  }

  @Test()
  async testHeaderMissing() {
    const response = new WebResponse();
    this.interceptor.config.mode = 'header';

    await this.interceptor.codec.encode(response, undefined);

    assert(!response.headers.has('Authorization'));
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