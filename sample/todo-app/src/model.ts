import { Model, ModelCore } from '@travetto/model';
import { Schema } from '@travetto/schema';

@Model()
export class Todo implements ModelCore {
  id?: string;
  text: string;
  created?: Date;
  completed?: boolean;
  priority?: number;
}

@Schema()
export class TodoSearch {
  offset?: number;
  limit?: number;
}