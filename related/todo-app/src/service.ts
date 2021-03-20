import { ElasticsearchModelService } from '@travetto/model-elasticsearch';
import { Injectable, Inject } from '@travetto/di';

import { Todo, TodoSearch } from './model';

@Injectable()
export class TodoService {

  @Inject()
  private modelService: ElasticsearchModelService;

  async add(todo: Todo) {
    todo.created = new Date();
    const saved = await this.modelService.create(Todo, todo);
    return saved;
  }

  async get(id: string) {
    return this.modelService.get(Todo, id);
  }

  async getAll(search: TodoSearch) {
    return this.modelService.query(Todo, { ...search, sort: [{ priority: -1 }] });
  }

  async complete(id: string, completed = true) {
    return this.modelService.updatePartial(Todo, Todo.from({ id, completed }));
  }

  async remove(id: string) {
    return this.modelService.delete(Todo, id);
  }
}