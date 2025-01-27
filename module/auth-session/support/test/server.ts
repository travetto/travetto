import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Inject } from '@travetto/di';
import { InjectableSuite } from '@travetto/di/support/test/suite';
import { BaseRestSuite } from '@travetto/rest/support/test/base';

import { SessionService } from '@travetto/auth-session';
import { AuthContext, AuthenticationError } from '@travetto/auth';
import { WithSuiteContext } from '@travetto/context/support/test/context';

@Suite()
@InjectableSuite()
@WithSuiteContext()
export abstract class AuthSessionServerSuite extends BaseRestSuite {

  timeScale = 1;

  @Inject()
  auth: AuthContext;

  @Inject()
  session: SessionService;

  @Test()
  async testSessionEstablishment() {
    this.auth.principal = {
      id: 'orange',
      details: {},
      sessionId: 'blue'
    };

    assert(this.session.get() === undefined);
    assert(await this.session.load() === undefined);

    const sess = this.session.getOrCreate();
    assert(sess.id === this.auth.principal.sessionId);
    sess.data = { name: 'bob' };
    await this.session.persist();

    this.session.clear(); // Disconnect

    assert(await this.session.load() !== undefined);
    const sess2 = this.session.getOrCreate();
    assert(sess2.data?.name === 'bob');
  }

  @Test()
  async testUnauthenticatedSession() {
    await assert.throws(() => this.session.getOrCreate(), AuthenticationError);

  }
}