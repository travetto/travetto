import { Model } from '@travetto/model';
import { sortedIndex } from '@travetto/model-indexed';
import { Schema } from '@travetto/schema';

@Model()
export class Todo {
  id: string;
  text: string;
  created?: Date;
  completed?: boolean;
  priority?: number;
  who?: string;
  color?: string;
}

export const todoByCreated = sortedIndex(Todo, {
  name: 'todoByCreated',
  key: {},
  sort: { created: -1 }
});

@Schema()
export class TodoSearch {
  q?: string;
  offset?: number;
  limit?: number;
}