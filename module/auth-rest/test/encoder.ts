import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { Inject, Injectable } from '@travetto/di';
import { FilterContext, Request, Response } from '@travetto/rest';
import { InjectableSuite } from '@travetto/di/test-support/suite';
import { ValueAccessor } from '@travetto/rest/src/internal/accessor';
import { Principal } from '@travetto/auth/src/types/principal';
import { Config } from '@travetto/config';

import { PrincipalEncoder } from '../src/encoder';

@Config('stateless')
class StatelessEncoderConfig {
  transport: 'header' | 'cookie' = 'header';
  keyName = 'secret';
}

@Injectable()
export class StatelessPrincipalEncoder implements PrincipalEncoder {

  @Inject()
  config: StatelessEncoderConfig;

  accessor: ValueAccessor;

  postConstruct() {
    this.accessor = new ValueAccessor(this.config.keyName, this.config.transport);
  }

  async encode({ res }: FilterContext, principal?: Principal): Promise<void> {
    if (principal) {
      const text = Buffer.from(JSON.stringify(principal)).toString('base64');
      this.accessor.writeValue(res, text, { expires: principal?.expiresAt });
    } else {
      this.accessor.writeValue(res, null, { expires: new Date() });
    }
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
  instance: PrincipalEncoder;

  @Test()
  async testHeader() {
    this.config.transport = 'header';

    const headers: Record<string, string> = {};

    await this.instance.encode(
      {
        req: {} as Request,
        res: {
          setHeader(key: string, value: string) {
            headers[key] = value;
          }
        } as Response
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
      req: {} as Request,
      res: {
        setHeader(key: string, value: string) {
          headers[key] = value;

        }
      } as Response
    }, undefined);

    assert(headers[this.config.keyName] === undefined);
  }
}