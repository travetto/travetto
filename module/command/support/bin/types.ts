import { CommandService } from '../../src/types';

export const SERVICE_ACTIONS = ['start', 'stop', 'status', 'restart'] as const;
export type ServiceAction = (typeof SERVICE_ACTIONS)[number];
export type ServiceRunningMode = 'running' | 'startup';
export type ServiceStatus = 'started' | 'stopped' | 'starting' | 'stopping' | 'initializing' | 'failed';
export type ServiceEvent = { statusText: string, status: ServiceStatus };
export type ServicesEvent = ServiceEvent & { svc: CommandService, idx: number };