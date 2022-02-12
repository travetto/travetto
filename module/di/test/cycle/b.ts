import { Injectable, Inject } from '../../src/decorator';
import { ABC } from './a';

@Injectable()
export class BCD {
  @Inject()
  a: ABC;
}