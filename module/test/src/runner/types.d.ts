import { Consumer } from '../model/consumer';

export interface State {
  format: string;
  consumer?: Consumer;
  mode: 'single' | 'watch' | 'all';
  concurrency: number;
  args: string[];
}
