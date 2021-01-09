import { Injectable, DependencyRegistry } from '@travetto/di';

@Injectable()
class Complex { }

class ManualLookup {
  async invoke() {
    const complex = await DependencyRegistry.getInstance(Complex);
    return complex;
  }
}