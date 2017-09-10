import { Class } from '@encore2/registry';
import { ModelCore, Query, QueryOptions, BulkState } from '../model';
import { ModelService } from './model';

export abstract class ClassModelService<T extends { id: ID }, ID = T['id']> {

  constructor(private service: ModelService) { }

  abstract get class(): Class<T>;

  getAllByQuery(query: Query = {}, options: QueryOptions = {}) {
    return this.service.getAllByQuery(this.class, query, options);
  }

  getCountByQuery(query: Query = {}) {
    return this.service.getCountByQuery(this.class, query);
  }

  getByQuery(query: Query, options: QueryOptions = {}, failOnMany: boolean = true) {
    return this.service.getByQuery(this.class, query, options, failOnMany);
  }

  getIdsByQuery(query: Query, options: QueryOptions = {}) {
    return this.service.getIdsByQuery(this.class, query, options);
  }

  saveOrUpdate(o: T, query: Query) {
    return this.service.saveOrUpdate(o, query);
  }

  getById(id: ID) {
    return this.service.getById(this.class, id);
  }

  deleteById(id: ID) {
    return this.service.deleteById(this.class, id);
  }

  deleteByQuery(query: Query = {}) {
    return this.service.deleteByQuery(this.class, query);
  }

  save(o: T) {
    return this.service.save(o);
  }

  saveAll(objs: T[]) {
    return this.service.saveAll(objs);
  }

  update(o: T) {
    return this.service.update(o);
  }

  updateAll(objs: T[]) {
    return this.service.updateAll(objs);
  }

  updatePartial(o: Partial<T>, view: string) {
    return this.service.updatePartial(o, view);
  }

  updatePartialByQuery(o: Partial<T>, view: string, query: Query) {
    return this.service.updatePartialByQuery(o, view, query);
  }

  bulkProcess(state: BulkState<T>) {
    return this.service.bulkProcess(this.class, state);
  }
}