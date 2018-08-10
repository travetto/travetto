import { EntryPoint, Inject, Injectable } from '@travetto/di/src';

@Injectable()
class Element {
  name = 'roger';
}

@EntryPoint()
class EPTest {

  @Inject()
  el: Element;

  run() {
    console.log('Entry point for the win', this.el.name);
  }
}