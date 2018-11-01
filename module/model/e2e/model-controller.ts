import { Get, RestApp, RestAppProvider } from '@travetto/rest';
import { ChangeEvent, Class } from '@travetto/registry';
import { Injectable, InjectableFactory, Application } from '@travetto/di';
import { RestExpressAppProvider } from '@travetto/rest-express';

import { ModelController } from '../extension/rest';
import {
  Model, ModelSource, ModelService, ModelCore,
  ModelQuery, Query, BulkResponse,
  PageableModelQuery
} from '../';
import { QueryVerifierService } from '../src/service/verify';
import { BulkOp } from '../src/model/bulk';
import { Match } from '../../schema';

@Injectable({ target: ModelSource })
export class TestSource implements ModelSource {
  onChange(e: ChangeEvent<Class<any>>) {
    console.log('Changed model', e);
  }

  prePersist<T extends ModelCore>(cls: Class<T>, model: Partial<T>): Partial<T>;
  prePersist<T extends ModelCore>(cls: Class<T>, model: T): T;
  prePersist(cls: any, model: any): any {
    return model;
  }

  postLoad<T extends ModelCore>(cls: Class<T>, model: Partial<T>): Partial<T>;
  postLoad<T extends ModelCore>(cls: Class<T>, model: T): T;
  postLoad(cls: any, model: any): any {
    return model;
  }

  async save<T extends ModelCore>(cls: Class<T>, model: T): Promise<T> {
    return model;
  }

  async saveAll<T extends ModelCore>(cls: Class<T>, models: T[]): Promise<T[]> {
    return models;
  }

  async update<T extends ModelCore>(cls: Class<T>, model: T): Promise<T> {
    return model;
  }

  async updateAllByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<number> {
    return 10;
  }

  async updatePartial<T extends ModelCore>(cls: Class<T>, model: Partial<T>): Promise<T> {
    return model as T;
  }

  async updatePartialByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>, body: Partial<T>): Promise<T> {
    return body as T;
  }

  async query<T extends ModelCore, U>(cls: Class<T>, builder: Query<T>): Promise<U[]> {
    return [];
  }

  async bulkProcess<T extends ModelCore>(cls: Class<T>, state: BulkOp<T>[]): Promise<BulkResponse> {
    return {
      counts: {
        delete: 0,
        update: 0,
        insert: 0,
        upsert: 0,
        error: 0
      },
      errors: []
    };
  }

  async getById<T extends ModelCore>(cls: Class<T>, id: string): Promise<T> {
    return { id } as any as T;
  }
  async getByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>, failOnMany?: boolean | undefined): Promise<T> {
    return { id: '20' } as any as T;
  }
  async getAllByQuery<T extends ModelCore>(cls: Class<T>, query: PageableModelQuery<T>): Promise<T[]> {
    return [];
  }
  async getCountByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>): Promise<number> {
    return 20;
  }
  async deleteById<T extends ModelCore>(cls: Class<T>, id: string): Promise<number> {
    return 20;
  }
  async deleteByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>): Promise<number> {
    return 20;
  }
}

@Model()
class Simple implements ModelCore {
  id?: string;
  name: string;
  @Match(/^\w{10}.\w{3}@\w{10}.com/)
  userName: string;
}

class Config {
  @InjectableFactory()
  static getSvc(src: ModelSource, qry: QueryVerifierService): ModelService {
    return new ModelService(src, qry);
  }

  @InjectableFactory()
  static getRest(): RestAppProvider {
    return new RestExpressAppProvider();
  }
}

@ModelController('/model', Simple)
export class SimpleModelController {
  constructor(public source: ModelService) { }

  @Get('/fun')
  getById() {
    return {
      message: 'Custom get all by'
    };
  }

}

@Application('simple')
class App {
  constructor(private app: RestApp) { }

  run() {
    return this.app.run();
  }
}