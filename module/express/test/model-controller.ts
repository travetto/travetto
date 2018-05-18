import { Controller } from '..';
import { ModelController } from '../support/extension.model';
import { Model, BaseModel, ClassModelService, ModelSource, ModelService, ModelCore, ModelQuery, Query, BulkState, BulkResponse, PageableModelQuery } from '@travetto/model';
import { QueryVerifierService } from '@travetto/model/src/service/query';
import { ChangeEvent, Class } from '@travetto/registry';
import { Injectable, InjectableFactory } from '@travetto/di';

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

  async bulkProcess<T extends ModelCore>(cls: Class<T>, state: BulkState<T>): Promise<BulkResponse> {
    return {
      count: {},
      error: []
    };
  }

  async getById<T extends ModelCore>(cls: Class<T>, id: string): Promise<T> {
    return { id } as T;
  }
  async getByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>, failOnMany?: boolean | undefined): Promise<T> {
    return { id: '20' } as T;
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
class Simple extends BaseModel {

}

class Config {
  @InjectableFactory()
  static getSvc(src: ModelSource, qry: QueryVerifierService): ModelService {
    return new ModelService(src, qry);
  }
}

@ModelController('/model', Simple)
export class SimpleModelController {
  constructor(public source: ModelService) {
  }

}
