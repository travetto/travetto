import { Injectable } from '../../../src/decorator';

@Injectable()
export class DependentService {
  doWork() { }
}

export class CustomService {
  constructor(private dep: DependentService) { }
}