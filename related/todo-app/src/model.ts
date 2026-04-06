import { Model } from '@travetto/model';
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

@Schema()
export class TodoSearch {
  q?: string;
  offset?: number;
  limit?: number;
}