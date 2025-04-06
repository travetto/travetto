'@Application';
import { InjectableFactory } from '@travetto/di';
import { WebConfig, WebApplication } from '@travetto/web';
import { asFull } from '@travetto/runtime';

class Config {
  @InjectableFactory()
  static target(config: WebConfig): WebApplication {
    return asFull<WebApplication>({
      async run() {
        return { on() { }, close() { } };
      }
    });
  }
}