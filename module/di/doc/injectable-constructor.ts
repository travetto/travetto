import { Injectable } from '@travetto/di';
import { DependentService } from './dep.ts';

@Injectable()
class CustomService {

  dependentService: DependentService;

  constructor(service: DependentService) {
    this.dependentService = service;
  }

  async coolOperation() {
    await this.dependentService.doWork();
  }
}