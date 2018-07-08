import { ExpressApp } from './app';

export abstract class ExpressOperator {

  priority = 1000;

  abstract operate(app: ExpressApp): void;
}