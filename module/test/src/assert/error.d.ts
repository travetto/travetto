declare module "assert" {
  interface AssertionError {
    toConsole(): string;
  }
}