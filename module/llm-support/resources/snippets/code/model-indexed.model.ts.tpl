import { Model, type ModelId } from '@travetto/model';

@Model()
export class {{modelName}} {
  id: ModelId;
  name: string;
  createdAt: Date;
}
