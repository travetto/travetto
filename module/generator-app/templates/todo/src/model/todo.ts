import { Model, ModelCore } from '@travetto/model';

@Model()
export class Todo implements ModelCore {
  id?: string;
  text: string;
  completed?: boolean;
  // {{#modules.auth-rest}} // @doc-exclude
  userId?: string;  // @doc-exclude
  // {{/modules.auth-rest}}  // @doc-exclude
}