import { Injectable, Inject } from '@travetto/di';

export abstract class Contract {

}

@Injectable()
class SimpleContract extends Contract { }

@Injectable()
export class ComplexContract extends Contract { }

@Injectable()
class ContractConsumer {
  // Will default to SimpleContract if nothing else registered
  @Inject()
  contract: Contract;
}