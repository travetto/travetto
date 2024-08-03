import { Model, ModelType } from '@travetto/model';

@Model()
export class Todo implements ModelType {
  id: string;
  text: string;
  completed?: boolean;
  // {{#modules.auth_rest}}
  userId?: string;
  // {{/modules.auth_rest}} 
}