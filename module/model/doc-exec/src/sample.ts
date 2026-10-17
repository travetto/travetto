import { Model, type ModelId } from '@travetto/model';

@Model()
export class SampleModel {
  id: ModelId;
  name: string;
  age: number;
}
