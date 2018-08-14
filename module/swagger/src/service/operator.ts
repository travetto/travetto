import { ExpressOperator } from '@travetto/express';
import { Injectable } from '@travetto/di';

@Injectable()
export class SwaggerOperator extends ExpressOperator {
  operate(): void {
    require('./controller');
  }
}
