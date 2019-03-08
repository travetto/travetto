import { ModelService } from '@travetto/model';
import { Injectable, Inject } from '@travetto/di';
import { Todo, TodoSearch } from './model';

@Injectable()
export class TodoService {

  @Inject()
  private modelService: ModelService;

  async add(todo: Todo) {
    todo.created = new Date();
    const saved = await this.modelService.save(Todo, todo);
    return saved;
  }

  async get(id: string) {
    return this.modelService.getById(Todo, id);
  }

  async getAll(search: TodoSearch) {
    return this.modelService.getAllByQuery(Todo, search);
  }

  async complete(id: string, completed = true) {
    return this.modelService.updatePartial(Todo,
      { id, completed }
    );
  }

  async remove(id: string) {
    return this.modelService.deleteById(Todo, id);
  }
}