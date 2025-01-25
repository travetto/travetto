import { AsyncContext, WithAsyncContext } from '@travetto/context';
import { Inject } from '@travetto/di';

export class SystemInitiatedContext {

  @Inject()
  context: AsyncContext;

  @WithAsyncContext({
    user: 'system',
    uid: 20
  })
  async runJob(name: string) {
    console.log('Running', { user: this.context.get('user'), jobName: name });
  }
}
