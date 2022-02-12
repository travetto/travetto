import { Injectable, Inject } from '../../src/decorator';

import { BCD } from './b';

@Injectable()
export class ABC {
  @Inject()
  b: BCD;
}
