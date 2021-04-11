import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { Inject, Injectable } from '@travetto/di';
import { Request, Response } from '@travetto/rest';
import { InjectableSuite } from '@travetto/di/test-support/suite';
import { ValueAccessor } from '@travetto/rest/src/internal/accessor';

import { Session } from '../src/session';
import { SessionConfig } from '../src/config';
import { SessionProvider } from '../src/provider';

@Injectable()
export class StatelessSessionProvider implements SessionProvider {

  @Inject()
  config: SessionConfig;

  accessor: ValueAccessor;

  postConstruct() {
    this.accessor = new ValueAccessor(this.config.keyName, this.config.transport);
  }

  async encode(req: Request, res: Response, session: Session | null): Promise<void> {
    if (session) {
      const text = Buffer.from(JSON.stringify(session.toJSON())).toString('base64');
      this.accessor.writeValue(res, text, { expires: session?.expiresAt });
    } else {
      this.accessor.writeValue(res, null, { expires: new Date() });
    }
    return;
  }

  async decode(req: Request): Promise<Session | undefined> {
    const text = this.accessor.readValue(req);
    if (text) {
      const parsed = JSON.parse(Buffer.from(text, 'base64').toString('utf8'));
      return new Session({
        ...parsed,
        expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : parsed.expiresAt,
        issuedAt: parsed.issuedAt ? new Date(parsed.issuedAt) : parsed.issuedAt
      });
    }
  }
}


@Suite()
@InjectableSuite()
export class EncoderTest {

  @Inject()
  instance: StatelessSessionProvider;

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