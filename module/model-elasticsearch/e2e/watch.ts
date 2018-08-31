import { Model, ModelCore, ModelSource, ModelService } from '@travetto/model';
import { Schema } from '@travetto/schema';
import { DependencyRegistry, InjectableFactory } from '@travetto/di';

import { ModelElasticsearchSource, ModelElasticsearchConfig } from '../';

@Schema()
class Address {
  street1: string;
  street2?: string;
  city: string;
  zip?: number;
}

@Model()
class Person implements ModelCore {
  id?: string;
  name: string;
  age: number;
  gender: 'm' | 'f';
  address: Address;
}

class Config {
  @InjectableFactory()
  static getSource(config: ModelElasticsearchConfig): ModelSource {
    return new ModelElasticsearchSource(config);
  }
}

setTimeout(async () => {
  await DependencyRegistry.getInstance(ModelService);
  console.log(Person);
}, 1000);