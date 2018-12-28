import { Application, Inject, Injectable } from '../';

@Injectable()
class Element {
  name = 'roger';
}

@Application('test-eptest', { watchable: true })
class EPTest {

  @Inject()
  el: Element;

  run() {
    console.log('Entry point for the win', this.el.name);
  }
}