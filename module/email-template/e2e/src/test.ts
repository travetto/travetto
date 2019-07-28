import { Application } from '@travetto/app';
import { DefaultMailTemplateEngine } from '../../src/template';

@Application('test-email')
export class TestEmailApp {
  constructor(private engine: DefaultMailTemplateEngine) {

  }

  async run() {
    const content = await this.engine.template('email/my-email.html', {
      footerOptions: {

      }
    });
    console.log(content);
  }
}