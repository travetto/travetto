import { AsyncContext } from '../../../src/service';
import { WithAsyncContext } from '../../../src/decorator';

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
