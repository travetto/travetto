import { Inject, Injectable } from '@travetto/di';
import { ABC } from './a.ts';

@Injectable()
export class BCD {
  @Inject()
  a: ABC = new ABC();
}