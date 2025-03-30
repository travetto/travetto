import { AsyncContext, WithAsyncContext } from '@travetto/context';
import { Inject } from '@travetto/di';

const NameSymbol = Symbol();

export class ContextAwareService {

  @Inject()
  context: AsyncContext;

  @WithAsyncContext()
  async complexOperator(name: string) {
    this.context.set(NameSymbol, name);
    await this.additionalOp('extra');
    await this.finalOp();
  }

  async additionalOp(additional: string) {
    const name = this.context.get(NameSymbol);
    this.context.set(NameSymbol, `${name} ${additional}`);
  }

  async finalOp() {
    const name = this.context.get(NameSymbol);
    // Use name
    return name;
  }
}