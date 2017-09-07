import { Registry } from '../index';

class Simple extends Registry {
  async _init() {
    return;
  }
}

export const SimpleRegistry = new Simple();