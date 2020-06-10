/**
 * Extensions to the Function interface, to provide common
 * information for all registered classes
 */
declare interface Function {
  __id: string;
  __file: string;
  __hash: number;
  __methods: Record<string, { hash: number }>;
  __synthetic: boolean;
  __abstract: boolean;
}