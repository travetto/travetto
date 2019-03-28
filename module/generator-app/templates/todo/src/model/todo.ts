import { Model, ModelCore } from '@travetto/model';

@Model()
export class Todo implements ModelCore {
  id?: string;
  text: string;
  completed: boolean;
  // {{#modules.map.auth-rest}}
  userId: string;
  // {{/modules.map.auth-rest}}
}