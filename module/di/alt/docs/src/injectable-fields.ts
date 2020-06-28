import { Injectable, Inject } from '../../../src/decorator';
import { DependentService } from './dep';

@Injectable()
class CustomService {
  @Inject()
  private dependentService: DependentService;

  async coolOperation() {
    await this.dependentService.doWork();
  }
}
