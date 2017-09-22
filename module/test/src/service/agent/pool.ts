import * as os from 'os';
import { Agent } from './agent';

export class AgentPool {
  agentCount: number;
  private agents = new Map<number, Agent>();
  private availableAgents = new Set<Agent>();
  private pendingAgents = new Set<Agent>();
  private initialized: Promise<any>;

  constructor(private command: string, count?: number) {
    if (!count) {
      count = os.cpus().length - 1;
    }
  }

  init() {
    if (!this.initialized) {
      this.initialized = this._init();
    }
    return this.initialized;
  }

  get availableSize() {
    return this.availableAgents.size;
  }

  async _init() {
    let agents = ' '.repeat(this.agentCount).split('').map((x, i) => this.initAgent(i));
    await Promise.all(agents);
  }

  async initAgent(runnerId: number) {
    let agent = new Agent(runnerId, this.command, e => {
      this.initAgent(runnerId);
    });
    await agent.init();
    this.agents.set(runnerId, agent);
    return agent;
  }

  async get(id: number) {
    await this.init();
    return this.agents.get(id);
  }

  async getNextAgent() {
    await this.init();
    if (this.availableAgents.size === 0) {
      return undefined;
    } else {
      let agent = this.availableAgents.values().next().value;
      this.availableAgents.delete(agent);
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
}