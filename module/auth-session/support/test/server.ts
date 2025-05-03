import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Inject } from '@travetto/di';
import { SessionContext, SessionService } from '@travetto/auth-session';
import { AuthContext, AuthenticationError } from '@travetto/auth';
import { AsyncContext, WithAsyncContext } from '@travetto/context';
import { Util } from '@travetto/runtime';

import { InjectableSuite } from '@travetto/di/support/test/suite.ts';

@Suite()
@InjectableSuite()
export abstract class AuthSessionServerSuite {

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

    const session = this.sessionContext.get(true);
    assert(session.id === this.auth.principal.sessionId);
    session.data = { name: 'bob' };
    await this.session.persist();

    this.sessionContext.set(undefined); // Disconnect

    assert(await this.session.load() !== undefined);
    const session2 = this.sessionContext.get(true);
    assert(session2.data?.name === 'bob');

    this.auth.principal = {
      id: 'orange',
      details: {},
      sessionId: Util.uuid()
    };

    this.sessionContext.set(undefined); // Disconnect

    assert(await this.session.load() === undefined);
    const session3 = this.sessionContext.get(true);
    assert.deepStrictEqual(session3.data, {});
  }

  @WithAsyncContext()
  @Test()
  async testUnauthenticatedSession() {
    await assert.throws(() => this.sessionContext.get(true), AuthenticationError);

  }
}