import { DependencyRegistryIndex, Inject, Injectable, InjectableFactory } from '@travetto/di';
import { toConcrete } from '@travetto/runtime';

/**
 * @concrete
 */
export interface ServiceContract {
  deleteUser(userId: string): Promise<void>;
}

class MyCustomService implements ServiceContract {
  async deleteUser(userId: string): Promise<void> {
    // Do something
  }
}

@Injectable()
class SpecificService {

  @Inject()
  service: ServiceContract;
}

class ManualInvocationOfInterface {
  @InjectableFactory()
  static getCustomService(): Promise<ServiceContract> {
    return DependencyRegistryIndex.getInstance<ServiceContract>(toConcrete<ServiceContract>());
  }
}