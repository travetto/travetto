import { Model, BaseModel, ModelRegistry, ModelSource, ModelService } from '@travetto/model';
import { Schema, Integer, MaxLength, MinLength, Float } from '@travetto/schema';
import { ModelElasticsearchSource, ModelElasticsearchConfig } from '../src';
import { DependencyRegistry, InjectableFactory } from '@travetto/di';

@Schema()
class Address {
  street1: string;
  street2?: string;
  city: string;
  zip?: number;
}

@Model()
class Person extends BaseModel {
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