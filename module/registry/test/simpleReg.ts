import { Registry } from '../index';

class Simple extends Registry {
  async init() {
    return;
  }
}

export const SimpleRegistry = new Simple();