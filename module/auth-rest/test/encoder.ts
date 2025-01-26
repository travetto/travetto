import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Inject, Injectable } from '@travetto/di';
import { RestCodecValue, FilterContext, Response, RestCodecTransport } from '@travetto/rest';
import { InjectableSuite } from '@travetto/di/support/test/suite';
import { Principal } from '@travetto/auth/src/types/principal';
import { Config } from '@travetto/config';
import { asFull } from '@travetto/runtime';

import { PrincipalCodec } from '../src/codec';

@Config('stateless')
class StatelessEncoderConfig {
  transport: RestCodecTransport = 'header';
  keyName = 'secret';
}

@Injectable()
export class StatelessPrincipalCodec implements PrincipalCodec {

  @Inject()
  config: StatelessEncoderConfig;

  accessor: RestCodecValue;

  postConstruct() {
    this.accessor = new RestCodecValue({
      cookie: this.config.transport === 'cookie' ? this.config.keyName : undefined!,
      header: this.config.transport === 'header' ? this.config.keyName : undefined,
      headerPrefix: 'Token'
    });
  }

  async encode({ res }: FilterContext, principal?: Principal): Promise<void> {
    const text = principal ? Buffer.from(JSON.stringify(principal)).toString('base64') : undefined;
    this.accessor.writeValue(res, text, { expires: principal?.expiresAt });
    return;
  }

  async decode({ req }: FilterContext): Promise<Principal | undefined> {
    const text = this.accessor.readValue(req);
    if (text) {
      const parsed = JSON.parse(Buffer.from(text, 'base64').toString('utf8'));
      return {
        ...parsed,
        expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : parsed.expiresAt,
        issuedAt: parsed.issuedAt ? new Date(parsed.issuedAt) : parsed.issuedAt
      };
    }
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