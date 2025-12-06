import { NeuroClient } from 'neuro-game-sdk'
import { DockerClient } from '@docker/node-sdk'
import { Logger } from '../utils/logger.js'

class NoderontainerConstants {
  public neuro!: NeuroClient
  public docker!: DockerClient
  public logger: Logger

  private onNeuroClientInit(): void {}

  private loadDockerClient(): void {
    DockerClient.fromDockerConfig()
      .then((c) => (this.docker = c))
      .catch((e) => {
        console.error(e)
      })
  }

  constructor() {
    this.logger = new Logger()
    // Do not create Neuro client here; initNeuro in index.ts will set it once.
    this.loadDockerClient()
  }

  public reloadNeuroClient(url?: string, name?: string): void {
    this.neuro = new NeuroClient(url ?? 'ws://host.docker.internal:8000', name ?? 'Docker Desktop', this.onNeuroClientInit)
  }

  public reloadDockerClient(): void {
    this.loadDockerClient()
  }
}

export const CONT = new NoderontainerConstants()
