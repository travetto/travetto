import { type AsyncContext, AsyncContextValue, WithAsyncContext } from '@travetto/context';
import { Inject } from '@travetto/di';

export class ContextValueService {

  @Inject()
  context: AsyncContext;

  #name = new AsyncContextValue<string>(this);

  @WithAsyncContext()
  async complexOperator(name: string) {
    this.#name.set(name);
    await this.additionalOperation('extra');
    await this.finalOperation();
  }

  async additionalOperation(additional: string) {
    const name = this.#name.get();
    this.#name.set(`${name} ${additional}`);
  }

  async finalOperation() {
    const name = this.#name.get();
    // Use name
    return name;
  }
}