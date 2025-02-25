import { InjectableFactory } from '@travetto/di';
import { Contract, ComplexContract } from './injectable-multiple-default.ts';

class Config {
  // Complex will be marked as the available Contract
  @InjectableFactory({ primary: true })
  static getContract(complex: ComplexContract): Contract {
    return complex;
  }
}