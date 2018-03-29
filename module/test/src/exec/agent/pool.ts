import * as os from 'os';
import { Agent } from './agent';
import { Shutdown } from '@travetto/base';

const { deserialize } = require('./error');

export class AgentPool {
  agentCount: number;
  private availableAgents = new Set<Agent>();
  private pendingAgents = new Set<Agent>();
  private initialized: Promise<any>;

  constructor(private command: string, count: number = 0) {
    this.agentCount = count || os.cpus().length - 1;
  }

  init() {
    for (let i = 0; i < this.agentCount; i++) {
      const agent = new Agent(i, this.command);
      this.availableAgents.add(agent);
    }
    Shutdown.onShutdown(this.constructor.__id, () => this.shutdown());
  }

  get availableSize() {
    return this.availableAgents.size;
  }

  async getNextAgent() {
    if (this.availableAgents.size === 0) {
      return undefined;
    } else {
      const agent = this.availableAgents.values().next().value;
      this.availableAgents.delete(agent);
      await agent.init();
      return agent;
    }
  }

  returnAgent(agent: Agent) {
    this.pendingAgents.delete(agent);
    this.availableAgents.add(agent);
    agent.clean();
  }

  async process<T, U>(inputs: T[], handler: (inp: T, run: (data: any) => void, agent?: Agent) => void) {
    await this.init();

    let position = 0;
    const errors: Error[] = [];

    while (position < inputs.length) {
      if (this.pendingAgents.size < this.availableSize) {
        const next = position++;
        const agent = (await this.getNextAgent())!;

        agent.completion = new Promise<Agent>((resolve, reject) => {
          agent.listenOnce('runComplete', ({ error }) => {

            if (error) {
              errors.push(deserialize(error));
            }

            resolve(agent);
          });
        });

        handler(inputs[next], (data) => {
          agent.send('run', data);
        }, agent);

        this.pendingAgents.add(agent);
      } else {
        const agent = await Promise.race(Array.from(this.pendingAgents).map(x => x.completion));
        this.returnAgent(agent);
      }
    }

    await Promise.all(Array.from(this.pendingAgents).map(x => x.completion));

    return errors;
  }

  shutdown() {
    for (const agent of Array.from(this.pendingAgents)) {
      this.returnAgent(agent);
    }

    for (const agent of Array.from(this.availableAgents)) {
      if (agent.process) {
        try {
          console.debug('Killing Process', agent.id)
          agent.process.kill('SIGKILL');
        } catch (e) {
          console.error('Error', agent.id, e);
        }
      }
    }
  }
}
