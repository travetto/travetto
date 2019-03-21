export abstract class RestAppCustomizer<T> {
  abstract customize(raw: T): Promise<T | void> | T | void;
}