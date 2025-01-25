import { Injectable } from '@travetto/di';

@Injectable()
export class DependentService {
  doWork() { }
}

export class CustomService {
  constructor(dep: DependentService) { }
}