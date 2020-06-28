import { Injectable } from '../../../src/decorator';
import { DependentService } from './dep';

@Injectable()
class CustomService {
  constructor(private dependentService: DependentService) { }

  async coolOperation() {
    await this.dependentService.doWork();
  }
}