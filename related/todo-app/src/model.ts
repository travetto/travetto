import { Model, type ModelId } from '@travetto/model';
import { Schema } from '@travetto/schema';

@Model()
export class Todo {
  id: ModelId;
  text: string;
  created?: Date;
  completed?: boolean;
  priority?: number;
  who?: string;
  color?: string;
}

@Schema()
export class TodoSearch {
  q?: string;
  offset?: number;
  limit?: number;
}
