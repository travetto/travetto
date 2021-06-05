import { Injectable } from '@travetto/di';

@Injectable()
export class MockService {
  async fetch(id?: number) {
    return {
      first: 'Name'
    };
  }

  async update({ name }: { name: string }) {

  }

  async fetchImage(path: string, opts: { width?: number, height?: number }) {

  }
}