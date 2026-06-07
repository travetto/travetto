import { Injectable } from '@travetto/di';

@Injectable()
export class HomeService {
  getMessage(): string {
    return 'Service is running';
  }
}
