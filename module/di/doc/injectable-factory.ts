import { InjectableFactory } from '@travetto/di';

// Not injectable by default
class CoolService {

}

class Config {
  @InjectableFactory()
  static initService() {
    return new CoolService();
  }
}
