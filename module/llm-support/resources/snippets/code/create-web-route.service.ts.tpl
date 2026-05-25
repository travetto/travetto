import { Injectable } from '@travetto/di';

@Injectable()
export class {{serviceName}} {
  getItems(): string[] {
    return ['item-1', 'item-2'];
  }
}
