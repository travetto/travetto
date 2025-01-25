import { AsyncContext, WithAsyncContext } from '@travetto/context';

const NAME = Symbol.for('My Custom name symbol');

export class ContextAwareService {

  context: AsyncContext;

  constructor(context: AsyncContext) {
    this.context = context;
  }

  @WithAsyncContext()
  async complexOperator(name: string) {
    this.context.set(NAME, name);
    await this.additionalOp('extra');
    await this.finalOp();
  }

  async additionalOp(additional: string) {
    const name = this.context.get(NAME);
    this.context.set(NAME, `${name} ${additional}`);
  }

  async finalOp() {
    const name = this.context.get(NAME);
    // Use name
    return name;
  }
}