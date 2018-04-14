import { ModelSource, Query, BulkResponse, BulkState, QueryOptions, ModelService, ModelCore, ModelQuery, PageableModelQuery } from '../index';
import { Class, ChangeEvent } from '@travetto/registry';
import { Person } from './models';
import { Injectable } from '@travetto/di';

@Injectable({ target: ModelSource })
export class TestSource implements ModelSource {
  onChange(e: ChangeEvent<Class<any>>) {
    console.log('Changed model', e);
  }

  prePersist<T extends ModelCore>(cls: Class<T>, model: Partial<T>): Partial<T>;
  prePersist<T extends ModelCore>(cls: Class<T>, model: T): T;
  prePersist(cls: any, model: any): any {
    throw new Error('Method not implemented.');
  }
  postLoad<T extends ModelCore>(cls: Class<T>, model: Partial<T>): Partial<T>;
  postLoad<T extends ModelCore>(cls: Class<T>, model: T): T;
  postLoad(cls: any, model: any): any {
    throw new Error('Method not implemented.');
  }
  save<T extends ModelCore>(cls: Class<T>, model: T): Promise<T> {
    throw new Error('Method not implemented.');
  }
  saveAll<T extends ModelCore>(cls: Class<T>, models: T[]): Promise<T[]> {
    throw new Error('Method not implemented.');
  }
  update<T extends ModelCore>(cls: Class<T>, model: T): Promise<T> {
    throw new Error('Method not implemented.');
  }
  updateAllByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<number> {
    throw new Error('Method not implemented.');
  }
  updatePartial<T extends ModelCore>(cls: Class<T>, model: Partial<T>): Promise<T> {
    throw new Error('Method not implemented.');
  }
  updatePartialByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>, body: Partial<T>): Promise<T> {
    throw new Error('Method not implemented.');
  }
  query<T extends ModelCore, U>(cls: Class<T>, builder: Query<T>): U[] {
    throw new Error('Method not implemented.');
  }
  bulkProcess<T extends ModelCore>(cls: Class<T>, state: BulkState<T>): Promise<BulkResponse> {
    throw new Error('Method not implemented.');
  }
  getById<T extends ModelCore>(cls: Class<T>, id: string): Promise<T> {
    throw new Error('Method not implemented.');
  }
  getByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>, failOnMany?: boolean | undefined): Promise<T> {
    throw new Error('Method not implemented.');
  }
  getAllByQuery<T extends ModelCore>(cls: Class<T>, query: PageableModelQuery<T>): Promise<T[]> {
    throw new Error('Method not implemented.');
  }
  getCountByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>): Promise<number> {
    throw new Error('Method not implemented.');
  }
  deleteById<T extends ModelCore>(cls: Class<T>, id: string): Promise<number> {
    throw new Error('Method not implemented.');
  }
  deleteByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>): Promise<number> {
    throw new Error('Method not implemented.');
  }

}