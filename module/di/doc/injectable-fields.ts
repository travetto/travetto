import { Injectable, Inject } from '@travetto/di';
import { DependentService } from './dep';

@Injectable()
class CustomService {
  @Inject()
  private dependentService: DependentService;

  async coolOperation() {
    await this.dependentService.doWork();
  }
}
