import { AsyncContext, WithAsyncContext } from '@travetto/context';

export class ContextAwareService {

  constructor(public context: AsyncContext) { }

  @WithAsyncContext()
  async complexOperator(name: string) {
    this.context.set({ name });
    await this.additionalOp('extra');
    await this.finalOp();
  }

  async additionalOp(additional: string) {
    const { name } = this.context.get();
    this.context.set({ name: `${name} ${additional}` });
  }

  async finalOp() {
    const { name } = this.context.get();
    // Use name
    return name;
  }
}