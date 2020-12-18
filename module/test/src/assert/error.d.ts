declare module "assert" {
  interface AssertionError {
    toJSON(): Record<string, any>;
  }
}