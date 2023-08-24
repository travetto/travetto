import { Controller, Post, Get, Delete, Put } from '@travetto/rest';
import { Specifier } from '@travetto/schema';

export function fetchRequestBody(from: string, suffix: string, port: number): string {
  return `
import { TodoApi } from '${from}';
const api = new TodoApi({ baseUrl: 'http://localhost:${port}', timeout: 100 });
  
async function go() {
const items = [];
const log = v => items.push(v);
log(await api.listTodo(200, 50, ['a','b','c'], 'green-2'));
log(await api.createTodo({id: '10', text:'todo', priority: 11}));
try {
  const result = await api.getLong(''+api.timeout);
  log('FAILED TO ERROR');
} catch (err) {
  log(err.message);
}
return JSON.stringify(items);
}
${suffix}
`;
}

export interface Todo {
  id: string;
  text: string;
  priority?: number;
  color?: `${'green' | 'blue'}-${number}${'-a' | '-b' | ''}`;
}

@Controller('rest/test/todo')
export class TodoController {
  @Post()
  async createTodo(todo: Todo): Promise<Todo> {
    return todo;
  }

  /** Get all the todos, yay! */
  @Get()
  async listTodo(limit?: number, offset?: number, categories?: string[], color?: Todo['color']): Promise<Todo[]> {
    return [{ text: `todo-${categories?.join('-') ?? 'none'}`, id: `${limit ?? 5}`, priority: offset, color }];
  }

  @Delete('/:id')
  async deleteTodo(id: string): Promise<number> {
    return 1;
  }

  @Put('/upload')
  async upload(@Specifier('file') data: Buffer): Promise<number> {
    return data.length;
  }

  @Post('/timeouts')
  async getLong(value: string): Promise<{ message: string }> {
    const start = Date.now();
    await new Promise(res => setTimeout(res, 200));
    return {
      message: [
        'LONG TIME',
        `serverStartTime=${new Date(start).toISOString().split('T')[1]}`,
        `serverEndTime=${new Date().toISOString().split('T')[1]}`,
        `value=${value} server=${Date.now() - start}`
      ].join(' ')
    };
  }
}
