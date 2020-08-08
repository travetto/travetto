import { Injectable } from '../../../src/decorator';
import { DependencyRegistry } from '../../../src/registry';

@Injectable()
class Complex { }

class ManualLookup {
  async invoke() {
    const complex = await DependencyRegistry.getInstance(Complex);
    return complex;
  }
}