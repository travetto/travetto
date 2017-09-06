import { ExpressApp } from './app';

export abstract class ExpressOperator {
  abstract operate(app: ExpressApp): void;
}