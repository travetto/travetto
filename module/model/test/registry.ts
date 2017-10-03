import { ModelSource, Query, BulkResponse, BulkState, QueryOptions, ModelService } from '../index';
import { Class, ChangeEvent } from '@travetto/registry';
import { Person } from './models';
import { Injectable } from '@travetto/di';

@Injectable({ target: ModelSource })
export class TestSource implements ModelSource {
  onChange(e: ChangeEvent) {
    console.log('Changed model', e);
  }

  getTypeField(): keyof Person {
    return 'type';
  }
  prePersist(cls: Class<Person>, model: Partial<Person>): Partial<Person>;
  prePersist(cls: Class<Person>, model: Person): Person;
  prePersist(cls: Class<Person>, model: Partial<Person> | Person): Partial<Person> | Person {
    throw new Error('Method not implemented.');
  }

  postLoad(cls: Class<Person>, model: Partial<Person>): Partial<Person>;
  postLoad(cls: Class<Person>, model: Person): Person;
  postLoad(cls: Class<Person>, model: Partial<Person> | Person): Partial<Person> | Person {
    throw new Error('Method not implemented.');
  }
  saveAll(cls: Class<Person>, models: Person[]): Promise<Person[]> {
    throw new Error('Method not implemented.');
  }
  save(cls: Class<Person>, model: Person): Promise<Person> {
    throw new Error('Method not implemented.');
  }
  update(cls: Class<Person>, model: Person): Promise<Person> {
    throw new Error('Method not implemented.');
  }
  updateAll(cls: Class<Person>, model: Person[]): Promise<number> {
    throw new Error('Method not implemented.');
  }
  updatePartial(cls: Class<Person>, model: Partial<Person>): Promise<Person> {
    throw new Error('Method not implemented.');
  }
  updatePartialByQuery(cls: Class<Person>, query: Query, body: Partial<Person>): Promise<number> {
    throw new Error('Method not implemented.');
  }
  updateAllByQuery(cls: Class<Person>, query: Query, body: Partial<Person>): Promise<number> {
    throw new Error('Method not implemented.');
  }
  bulkProcess(cls: Class<Person>, state: BulkState<Person>): Promise<BulkResponse> {
    throw new Error('Method not implemented.');
  }
  getById(cls: Class<Person>, id: string): Promise<Person> {
    throw new Error('Method not implemented.');
  }
  getByQuery(cls: Class<Person>, query: Query, options?: QueryOptions | undefined, failOnMany?: boolean | undefined): Promise<Person> {
    throw new Error('Method not implemented.');
  }
  getAllByQuery(cls: Class<Person>, query: Query, options?: QueryOptions | undefined): Promise<Person[]> {
    throw new Error('Method not implemented.');
  }
  getCountByQuery(cls: Class<Person>, query: Query): Promise<number> {
    throw new Error('Method not implemented.');
  }
  getIdsByQuery(cls: Class<Person>, query: Query, options?: QueryOptions | undefined): Promise<string[]> {
    throw new Error('Method not implemented.');
  }
  deleteById(cls: Class<Person>, id: string): Promise<number> {
    throw new Error('Method not implemented.');
  }
  deleteByQuery(cls: Class<Person>, query: Query): Promise<number> {
    throw new Error('Method not implemented.');
  }

}