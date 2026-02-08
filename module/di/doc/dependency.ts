import { Injectable } from '@travetto/di';

@Injectable()
export class DependentService {
  async doWork() { }
}

export class CustomService {
  constructor(service: DependentService) { }
}