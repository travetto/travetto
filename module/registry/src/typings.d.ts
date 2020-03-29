declare interface Function {
  __id: string;
  __file: string;
  __hash: number;
  __methods: Record<string, { hash: number }>;
  __abstract: boolean;
}