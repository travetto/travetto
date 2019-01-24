declare interface Function {
  __id: string;
  __file: string;
  __hash: string;
  __methods?: {
    [key: string]: {
      hash: string
    }
  };
  __abstract: boolean;
}