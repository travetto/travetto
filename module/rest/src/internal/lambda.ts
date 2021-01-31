import { Inject, Injectable } from '@travetto/di';
import { RestApplication } from '../application/rest';
import { RestServer } from '../application/server';

export const RestLambdaSym = Symbol.for('@trv:rest/aws-lambda');

@Injectable(RestLambdaSym)
export class RestLambdaApplication extends RestApplication {
  constructor(@Inject(RestLambdaSym) server: RestServer) {
    super();
    this.server = server;
  }

  handle(...args: unknown[]) {
    return (this.server as any).handle(...args);
  }
}