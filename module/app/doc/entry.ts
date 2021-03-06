import { Inject, Injectable } from '@travetto/di';
import { Application } from '@travetto/app';

@Injectable()
class Element {
  name = 'roger';
}

@Application('test-eptest')
class EpTest {

  @Inject()
  el: Element;

  run(age = 5, format: 'html' | 'pdf' = 'html') {
    console.debug('Entry point for the win', { age, typeOfAge: typeof age, format });
  }
}