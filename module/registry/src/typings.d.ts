declare interface Function {
  __id: string;
  __filename: string;
  __hash: string;
  __methods?: {
    [key: string]: {
      hash: string
    }
  };
  __abstract: boolean;
}