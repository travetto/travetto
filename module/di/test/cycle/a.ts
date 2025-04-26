import { Inject, Injectable } from '@travetto/di';

import { BCD } from './b.ts';

@Injectable()
export class ABC {
  @Inject()
  b: BCD;
}
