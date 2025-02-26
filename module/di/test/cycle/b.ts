import { Injectable, Inject } from '../../src/decorator.ts';
import { ABC } from './a.ts';

@Injectable()
export class BCD {
  @Inject()
  a: ABC;
}