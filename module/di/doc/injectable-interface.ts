import { DependencyRegistry, Inject, Injectable, InjectableFactory } from '@travetto/di';

class TargetConcrete { }

/**
 * @concrete #TargetConcrete
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
    return DependencyRegistry.getInstance<ServiceContract>(TargetConcrete);
  }
}