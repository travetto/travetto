import { Class } from '@travetto/registry';
import { ModelCore, Query, QueryOptions, BulkState, PageableModelQuery, ModelQuery } from '../model';
import { ModelService } from './model';

export abstract class ClassModelService<T extends ModelCore> {

  constructor(private service: ModelService) { }

  abstract get class(): Class<T>;

  query(query: Query<T>) {
    return this.service.query(this.class, query);
  }

  getAllByQuery(query: PageableModelQuery<T> = {}) {
    return this.service.getAllByQuery(this.class, query);
  }

  getCountByQuery(query: ModelQuery<T> = {}) {
    return this.service.getCountByQuery(this.class, query);
  }

  getByQuery(query: PageableModelQuery<T>, failOnMany: boolean = true) {
    return this.service.getByQuery(this.class, query, failOnMany);
  }

  saveOrUpdate(o: T, query: ModelQuery<T>) {
    return this.service.saveOrUpdate(this.class, o, query);
  }

  getById(id: string) {
    return this.service.getById(this.class, id);
  }

  deleteById(id: string) {
    return this.service.deleteById(this.class, id);
  }

  deleteByQuery(query: ModelQuery<T> = {}) {
    return this.service.deleteByQuery(this.class, query);
  }

  save(o: T) {
    return this.service.save(this.class, o);
  }

  saveAll(objs: T[]) {
    return this.service.saveAll(this.class, objs);
  }

  update(o: T) {
    return this.service.update(this.class, o);
  }

  updateAllByQuery(query: ModelQuery<T>, data: Partial<T>) {
    return this.service.updateAllByQuery(this.class, query, data);
  }

  updatePartial(o: Partial<T>) {
    return this.service.updatePartial(this.class, o);
  }

  updatePartialByQuery(query: ModelQuery<T>, o: Partial<T>) {
    return this.service.updatePartialByQuery(this.class, query, o);
  }

  updatePartialView(o: Partial<T>, view: string) {
    return this.service.updatePartialView(this.class, o, view);
  }

  updatePartialViewByQuery(o: Partial<T>, view: string, query: ModelQuery<T>) {
    return this.service.updatePartialViewByQuery(this.class, o, view, query);
  }

  bulkProcess(state: BulkState<T>) {
    return this.service.bulkProcess(this.class, state);
  }
}