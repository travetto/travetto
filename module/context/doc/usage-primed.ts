import { AsyncContext, WithAsyncContext } from '@travetto/context';

export class SystemInitiatedContext {

  context: AsyncContext;

  constructor(context: AsyncContext) {
    this.context = context;
  }

  @WithAsyncContext({
    user: 'system',
    uid: 20
  })
  async runJob(name: string) {
    console.log('Running', { user: this.context.get('user'), jobName: name });
  }
}
