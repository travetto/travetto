import { Injectable } from '@travetto/di';

@Injectable()
export class {{clientName}} {
  getEndpoint(): string {
    return '/{{routePath}}';
  }
}
