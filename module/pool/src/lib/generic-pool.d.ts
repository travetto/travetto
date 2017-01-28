declare module "generic-pool" {

  function createPool<T>(factory: PoolFactory<T>, config?: PoolConfig): Pool<T>;

  export interface Pool<T> {
    acquire(priority?: number): Promise<T>;
    drain(): Promise<void>;
    clear(): any;
    release(res: T): Promise<any>;
    destroy(res: T): Promise<any>;
    on(event: 'factoryCreateError', cb: (err: any) => void): void;
    on(event: 'factoryDestroyError', cb: (err: any) => void): void;

    spareResourceCapacity: number;
    size: number;
    available: number;
    borrowed: number;
    pending: number;
    min: number;
    max: number;
  }

  export interface PoolFactory<T> {
    create: () => Promise<T> | T;
    destroy: (res: T) => Promise<any> | undefined;
    validate?: (resource: T) => Promise<boolean> | boolean;
  }

  export interface PoolConfig {
    max?: number;
    min?: number;
    maxWaitingClients?: number;
    testsOnBorrow?: boolean;
    acquireTimeoutMillis?: number;
    fifo?: boolean;
    priorityRange?: number;
    autostart?: boolean;
    evictionRunIntervalMillis?: number;
    numTestsPerRun?: number;
    softIdleTimeoutMills?: number;
    idleTimeoutMillis?: number;
  }
}