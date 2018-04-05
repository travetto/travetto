import { ChangeSource, ChangeEvent } from './types';
import { Class } from '../model';

export class CompilerMethodSource implements ChangeSource<[Class, Function]> {

  private listeners: ((e: ChangeEvent<[Class<any>, Function]>) => void)[];

  constructor(public classSource: ChangeSource<Class>) {
    classSource.on(e => this.onClassEvent(e));
  }

  async init() { }

  onClassEvent(e: ChangeEvent<Class>) {

  }

  on(callback: (e: ChangeEvent<[Class<any>, Function]>) => void): void {
    this.listeners.push(callback);
  }

  reset(): void {
  }
}