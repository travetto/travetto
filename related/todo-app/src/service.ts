import { SQLDialect, SQLModelService } from '@travetto/model-sql';
import { SqliteDialect } from '@travetto/model-sql/src/dialect/sqlite/dialect';
import { Injectable, Inject, InjectableFactory } from '@travetto/di';

import { Todo, TodoSearch } from './model';

class SQLConfig {
  @InjectableFactory({ primary: true })
  static getDialect(dialect: SqliteDialect): SQLDialect {
    return dialect;
  }
}

@Injectable()
export class TodoService {

  @Inject()
  private modelService: SQLModelService;

  async add(todo: Todo) {
    todo.created = new Date();
    const saved = await this.modelService.create(Todo, todo);
    return saved;
  }

  async get(id: string) {
    return this.modelService.get(Todo, id);
  }

  async getAll(search: TodoSearch) {
    return this.modelService.query(Todo, { where: { text: { $regex: search.q ?? '.*' } }, ...search, sort: [{ created: -1 }] });
  }

  async complete(id: string, completed = true) {
    return this.modelService.updatePartial(Todo, Todo.from({ id, completed }));
  }

  async remove(id: string) {
    return this.modelService.delete(Todo, id);
  }
}