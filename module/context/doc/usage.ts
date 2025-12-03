import { AsyncContext, WithAsyncContext } from '@travetto/context';
import { Inject } from '@travetto/di';

const NameSymbol = Symbol();

export class ContextAwareService {

  @Inject()
  context: AsyncContext;

  @WithAsyncContext()
  async complexOperator(name: string) {
    this.context.set(NameSymbol, name);
    await this.additionalOperation('extra');
    await this.finalOperation();
  }

  async additionalOperation(additional: string) {
    const name = this.context.get(NameSymbol);
    this.context.set(NameSymbol, `${name} ${additional}`);
  }

  async finalOperation() {
    const name = this.context.get(NameSymbol);
    // Use name
    return name;
  }
}