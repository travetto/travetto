import { AsyncContext, WithAsyncContext } from '@travetto/context';

export class SystemInitiatedContext {

  constructor(public context: AsyncContext) { }

  @WithAsyncContext({
    user: 'system',
    uid: 20
  })
  async runJob(name: string) {
    console.log('Running', { user: this.context.get().user, jobName: name });
  }
}
