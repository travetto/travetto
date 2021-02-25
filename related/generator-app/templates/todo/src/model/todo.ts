import { Model, ModelType } from '@travetto/model';

@Model()
export class Todo implements ModelType {
  id: string;
  text: string;
  completed?: boolean;
  // {{#modules.auth-rest}} // @doc-exclude
  userId?: string;  // @doc-exclude
  // {{/modules.auth-rest}}  // @doc-exclude
}