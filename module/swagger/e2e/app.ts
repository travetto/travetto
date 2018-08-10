import { Application, InjectableFactory } from '@travetto/di';
import { ExpressApp, CompressionOperator, BodyOperator, SessionOperator, ExpressOperatorSet, ExpressOperator } from '@travetto/express';
import { SwaggerOperator, ClientGenerate } from '../src';
import { Class } from '@travetto/registry';

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getStack(
    comp: CompressionOperator,
    body: BodyOperator,
    session: SessionOperator,
    swg: SwaggerOperator
  ): ExpressOperatorSet {
    return new ExpressOperatorSet(
      [comp, body, session, swg].map(x => x.constructor as Class<ExpressOperator>)
    );
  }

  constructor(private app: ExpressApp, private cg: ClientGenerate) { }

  run() {
    this.app.run();
  }
}