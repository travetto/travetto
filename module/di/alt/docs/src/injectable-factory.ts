import { InjectableFactory } from '../../../src/decorator';

// Not injectable by default
class CoolService {

}

class Config {
  @InjectableFactory()
  static initService() {
    return new CoolService();
  }
}
