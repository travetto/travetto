import { Application, Inject, Injectable } from '@travetto/di';

@Injectable()
class Element {
  name = 'roger';
}

@Application('test-eptest')
class EPTest {

  @Inject()
  el: Element;

  run() {
    console.log('Entry point for the win', this.el.name);
  }
}