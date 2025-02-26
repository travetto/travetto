import { Injectable, Inject } from '../../src/decorator.ts';

import { BCD } from './b.ts';

@Injectable()
export class ABC {
  @Inject()
  b: BCD;
}
