import { Injectable, DependencyRegistryIndex } from '@travetto/di';

@Injectable()
class Complex { }

class ManualLookup {
  async invoke() {
    const complex = await DependencyRegistryIndex.getInstance(Complex);
    return complex;
  }
}