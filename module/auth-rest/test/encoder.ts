import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Inject, Injectable } from '@travetto/di';
import { RestCodecValue, FilterContext, Response, RestCodecTransport } from '@travetto/rest';
import { InjectableSuite } from '@travetto/di/support/test/suite';
import { Principal } from '@travetto/auth/src/types/principal';
import { Config } from '@travetto/config';
import { asFull } from '@travetto/runtime';

import { PrincipalCodec } from '../src/types';

@Config('stateless')
class StatelessEncoderConfig {
  transport: RestCodecTransport = 'header';
  keyName = 'secret';
}

@Injectable()
export class StatelessPrincipalCodec implements PrincipalCodec {

  @Inject()
  config: StatelessEncoderConfig;

  accessor: RestCodecValue<Principal>;

  postConstruct() {
    this.accessor = new RestCodecValue({
      cookie: this.config.transport === 'cookie' ? this.config.keyName : undefined!,
      header: this.config.transport === 'header' ? this.config.keyName : undefined,
      headerPrefix: 'Token'
    });
  }

  encode({ res }: FilterContext, principal?: Principal): void {
    return this.accessor.writeValue(res, principal, { expires: principal?.expiresAt });
  }

  decode({ req }: FilterContext): Principal | undefined {
    return this.accessor.readValue(req);
  }
}

@Suite()
@InjectableSuite()
export class EncoderTest {

  @Inject()
  config: StatelessEncoderConfig;

  @Inject()
  instance: PrincipalCodec;

  @Test()
  async testHeader() {
    this.config.transport = 'header';

    const headers: Record<string, string> = {};

    await this.instance.encode(
      {
        req: asFull({}),
        res: asFull<Response>({
          setHeader(key: string, value: string) {
            headers[key] = value;
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

    assert(headers[this.config.keyName] !== undefined);
  }

  @Test()
  async testHeaderMissing() {
    this.config.transport = 'header';

    const headers: Record<string, string> = {};

    await this.instance.encode({
      req: asFull({}),
      res: asFull<Response>({
        setHeader(key: string, value: string) {
          headers[key] = value;
        }
      }),
      config: {}
    }, undefined);

    assert(headers[this.config.keyName] === undefined);
  }
}