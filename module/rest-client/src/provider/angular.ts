import { ControllerVisitor } from '@travetto/rest';
import { ClassConfig } from '@travetto/schema';


export class AngularClientGenerator implements ControllerVisitor {

  #output: string;

  constructor(output: string) {
    this.#output = output;
  }

  onSchema(schema: ClassConfig): void {

  }
}