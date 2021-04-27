import { MongoModelService } from '@travetto/model-mongo';
import { Injectable, Inject } from '@travetto/di';

import { Todo, TodoSearch } from './model';

@Injectable()
export class TodoService {

  @Inject()
  private modelService: MongoModelService;

  async add(todo: Todo) {
    todo.created = new Date();
    const saved = await this.modelService.create(Todo, todo);
    return saved;
  }

  async update(todo: Todo) {
    return await this.modelService.updatePartial(Todo, todo);
  }

  async get(id: string) {
    return this.modelService.get(Todo, id);
  }

  async getAll(search: TodoSearch) {
    return this.modelService.query(Todo, { where: { text: { $regex: search.q ?? '.*' } }, ...search, sort: [{ created: -1 }] });
  }

  async deleteAllCompleted() {
    return this.modelService.deleteByQuery(Todo, { where: { completed: true } });
  }

  async complete(id: string, completed = true) {
    return this.modelService.updatePartial(Todo, Todo.from({ id, completed }));
  }

  async remove(id: string) {
    return this.modelService.delete(Todo, id);
  }
}