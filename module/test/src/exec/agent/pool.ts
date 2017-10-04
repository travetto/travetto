import * as os from 'os';
import { Agent } from './agent';

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
      let agent = new Agent(i, this.command);
      this.availableAgents.add(agent);
    }
  }

  get availableSize() {
    return this.availableAgents.size;
  }

  async getNextAgent() {
    if (this.availableAgents.size === 0) {
      return undefined;
    } else {
      let agent = this.availableAgents.values().next().value;
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

    while (position < inputs.length) {
      if (this.pendingAgents.size < this.availableSize) {
        let next = position++;
        let agent = (await this.getNextAgent())!;

        agent.completion = new Promise<Agent>((resolve, reject) => {
          agent.listenOnce('runComplete', (e: any) => {
            !e.error ? resolve(agent) : reject(e.error);
          });
        });

        handler(inputs[next], (data) => {
          agent.send('run', data);
        }, agent);

        this.pendingAgents.add(agent);
      } else {
        let agent = await Promise.race(Array.from(this.pendingAgents.values()).map(x => x.completion));
        this.returnAgent(agent);
      }
    }

    await Promise.all(Array.from(this.pendingAgents.values()).map(x => x.completion));
  }

  shutdown() {
    for (let agent of this.pendingAgents) {
      this.returnAgent(agent);
    }
    for (let agent of this.availableAgents) {
      agent.process.kill('SIGKILL');
    }
  }
}