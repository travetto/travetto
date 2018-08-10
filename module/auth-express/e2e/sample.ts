import { Application, InjectableFactory } from '@travetto/di';
import { ExpressApp, ExpressOperatorSet, CompressionOperator, BodyOperator, SessionOperator, ExpressOperator } from '@travetto/express';
import { Class } from '@travetto/registry';

import { AuthOperator } from '../src';
import { AuthPassportOperator } from '../extension/passport';

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getStack(
    comp: CompressionOperator,
    body: BodyOperator,
    session: SessionOperator,
    auth: AuthOperator,
    pass: AuthPassportOperator
  ): ExpressOperatorSet {
    return new ExpressOperatorSet(
      [comp, body, session, auth, pass].map(x => x.constructor as Class<ExpressOperator>)
    );
  }

  constructor(private app: ExpressApp) { }

  run() {
    this.app.run();
  }
}