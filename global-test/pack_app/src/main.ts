import { Application } from '@travetto/app';

@Application('double')
export class MainApp {
  async run(age: number): Promise<void> {
    console.log(`Result: ${age * 2}`);
  }
}