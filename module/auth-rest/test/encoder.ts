import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Inject, Injectable } from '@travetto/di';
import { Response } from '@travetto/rest';
import { InjectableSuite } from '@travetto/di/support/test/suite';
import { asFull } from '@travetto/runtime';

import { PrincipalCodec } from '../src/types';
import { CommonPrincipalCodec } from '../src/codec';

@Injectable()
export class StatelessPrincipalCodec extends CommonPrincipalCodec implements PrincipalCodec {
  constructor() { super({ mode: 'header' }); }
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