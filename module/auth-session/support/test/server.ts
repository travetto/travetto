import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Inject } from '@travetto/di';
import { SessionService } from '@travetto/auth-session';
import { AuthContext, AuthenticationError } from '@travetto/auth';
import { AsyncContext, WithAsyncContext } from '@travetto/context';
import { Util } from '@travetto/runtime';

import { InjectableSuite } from '@travetto/di/support/test/suite.ts';
import { BaseRestSuite } from '@travetto/rest/support/test/base.ts';

@Suite()
@InjectableSuite()
export abstract class AuthSessionServerSuite extends BaseRestSuite {

  timeScale = 1;

  @Inject()
  auth: AuthContext;

  @Inject()
  session: SessionService;

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

    assert(this.session.get() === undefined);
    assert(await this.session.load() === undefined);

    const session = this.session.getOrCreate();
    assert(session.id === this.auth.principal.sessionId);
    session.data = { name: 'bob' };
    await this.session.persist();

    this.session.clear(); // Disconnect

    assert(await this.session.load() !== undefined);
    const session2 = this.session.getOrCreate();
    assert(session2.data?.name === 'bob');

    this.auth.principal = {
      id: 'orange',
      details: {},
      sessionId: Util.uuid()
    };

    this.session.clear(); // Disconnect

    assert(await this.session.load() === undefined);
    const session3 = this.session.getOrCreate();
    assert.deepStrictEqual(session3.data, {});
  }

  @WithAsyncContext()
  @Test()
  async testUnauthenticatedSession() {
    await assert.throws(() => this.session.getOrCreate(), AuthenticationError);

  }
}