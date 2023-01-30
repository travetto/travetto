export const SERVICE_ACTIONS = ['start', 'stop', 'status', 'restart'] as const;
export type ServiceAction = (typeof SERVICE_ACTIONS)[number];
export type ServiceRunningMode = 'running' | 'startup';
export type ServiceStatus = 'started' | 'stopped' | 'starting' | 'stopping' | 'initializing' | 'failed';
export type ServiceEvent = { statusText: string, status: ServiceStatus };
export type ServicesEvent = ServiceEvent & { svc: Service, idx: number };

export type Service = {
  name: string;
  version: string | number;
  port?: number;
  ports?: Record<number, number>;
  privileged?: boolean;
  image: string;
  args?: string[];
  ready?: { url: string, test?(body: string): boolean };
  volumes?: Record<string, string>;
  env?: Record<string, string>;
  require?: string;
};