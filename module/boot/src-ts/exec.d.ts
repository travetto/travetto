declare module 'worker_threads' {
  interface WorkerOptions {
    argv?: string[];
  }
}