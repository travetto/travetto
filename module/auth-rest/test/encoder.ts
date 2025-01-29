import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Inject, Injectable } from '@travetto/di';
import { FilterContext, Response } from '@travetto/rest';
import { InjectableSuite } from '@travetto/di/support/test/suite';
import { asFull } from '@travetto/runtime';
import { Principal } from '@travetto/auth';

import { PrincipalCodec } from '../src/types';
import { RestAuthConfig } from '../src/config';

@Injectable()
export class StatelessPrincipalCodec implements PrincipalCodec {
  @Inject()
  auth: RestAuthConfig;

  decode(ctx: FilterContext): Promise<Principal | undefined> | Principal | undefined {
    return this.auth.readValue(ctx.req);
  }

  encode(ctx: FilterContext, data: Principal | undefined): Promise<void> | void {
    return this.auth.writeValue(ctx.res, data, data?.expiresAt);
  }
}

@Suite()
@InjectableSuite()
export class EncoderTest {

  @Inject()
  instance: PrincipalCodec;

  @Test()
  async testHeader() {
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

    assert(headers.Authorization !== undefined);
  }

  @Test()
  async testHeaderMissing() {
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

    assert(headers.Authorization === undefined);
  }
}