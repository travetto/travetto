export interface Handler {
  defaultTimeout: number;
  init?: () => Promise<any>;
  setup?: () => Promise<any>;
  before?: () => any;
  after?: () => any;
  exec?: (op: Function) => any;
}