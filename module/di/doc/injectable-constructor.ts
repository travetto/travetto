import { Injectable } from '@travetto/di';
import { DependentService } from './dep';

@Injectable()
class CustomService {
  constructor(private dependentService: DependentService) { }

  async coolOperation() {
    await this.dependentService.doWork();
  }
}