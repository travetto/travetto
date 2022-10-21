/**
 * Extensions to the Function interface, to provide common
 * information for all registered classes
 */
declare interface Function {
  Ⲑid: string;
  Ⲑfile: string;
  Ⲑmeta?: {
    id: string;
    file: string;
    hash: number;
    methods: Record<string, { hash: number }>;
    synthetic: boolean;
    abstract: boolean;
  }
}