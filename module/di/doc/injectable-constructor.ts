import { Injectable } from '@travetto/di';
import { DependentService } from './dep.ts';

@Injectable()
class CustomService {

  dependentService: DependentService;

  constructor(svc: DependentService) {
    this.dependentService = svc;
  }

  async coolOperation() {
    await this.dependentService.doWork();
  }
}