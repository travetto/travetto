import { Inject, Injectable } from '@travetto/di';
import { Application } from '../..';

@Injectable()
class Element {
  name = 'roger';
}

@Application('test-eptest', { watchable: true })
class EPTest {

  @Inject()
  el: Element;

  run(age = 5, format: 'html' | 'pdf' = 'html') {
    console.debug('Entry point for the win', age, typeof age, format);
  }
}