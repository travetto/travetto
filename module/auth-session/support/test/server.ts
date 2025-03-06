import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Inject } from '@travetto/di';
import { SessionContext, SessionService } from '@travetto/auth-session';
import { AuthContext, AuthenticationError } from '@travetto/auth';
import { AsyncContext, WithAsyncContext } from '@travetto/context';
import { Util } from '@travetto/runtime';

import { InjectableSuite } from '@travetto/di/support/test/suite';
import { BaseWebSuite } from '@travetto/web/support/test/base';

@Suite()
@InjectableSuite()
export abstract class AuthSessionServerSuite extends BaseWebSuite {

  timeScale = 1;

  @Inject()
  auth: AuthContext;

  @Inject()
  session: SessionService;

  @Inject()
  sessionContext: SessionContext;

  @Inject()
  context: AsyncContext;

  @WithAsyncContext()
  @Test()
  async testSessionEstablishment() {
    this.auth.principal = {
      id: 'orange',
      details: {},
      sessionId: Util.uuid()
    };

    assert(this.sessionContext.get() === undefined);
    assert(await this.session.load() === undefined);

    const sess = this.sessionContext.get(true);
    assert(sess.id === this.auth.principal.sessionId);
    sess.data = { name: 'bob' };
    await this.session.persist();

    this.sessionContext.set(undefined); // Disconnect

    assert(await this.session.load() !== undefined);
    const sess2 = this.sessionContext.get(true);
    assert(sess2.data?.name === 'bob');

    this.auth.principal = {
      id: 'orange',
      details: {},
      sessionId: Util.uuid()
    };

    this.sessionContext.set(undefined); // Disconnect

    assert(await this.session.load() === undefined);
    const sess3 = this.sessionContext.get(true);
    assert.deepStrictEqual(sess3.data, {});
  }

  @WithAsyncContext()
  @Test()
  async testUnauthenticatedSession() {
    await assert.throws(() => this.sessionContext.get(true), AuthenticationError);

  }
}