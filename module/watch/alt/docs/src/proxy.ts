import { RetargettingProxy } from '../../../src/proxy';

class User { }

export class CoolService {
  async tricky() {
    const target = new User();
    const proxy = new RetargettingProxy(target);

    // Update target a second later
    setTimeout(() => {
      proxy.setTarget(new User());
    }, 1000);

    return proxy;
  }
}