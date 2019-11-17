import { Model, ModelCore } from '@travetto/model';

@Model()
export class Todo implements ModelCore {
  id?: string;
  text: string;
  completed?: boolean;
  // {{#modules.auth-rest}}
  userId?: string;
  // {{/modules.auth-rest}}
}