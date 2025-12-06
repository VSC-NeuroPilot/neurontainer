import { NeuroClient } from 'neuro-game-sdk';
import { DockerClient } from '@docker/node-sdk';
import { Logger } from '../utils/logger.js'

class NoderontainerConstants {
    public neuro: NeuroClient;
    public docker!: DockerClient;
    public logger: Logger;

    private onNeuroClientInit(): void {}

    private loadDockerClient(): void {
        DockerClient.fromDockerConfig().then((c) => this.docker = c).catch((e) => {
            console.error(e)
        })
    }

    constructor() {
        this.logger = new Logger()
        // Prefer docker.internal which is available inside Docker Desktop extensions; fall back to host.docker.internal
        this.neuro = new NeuroClient('ws://docker.internal:8000', 'Docker Desktop', this.onNeuroClientInit)
        this.neuro.onError = (_e) => {}
        this.loadDockerClient()
    }

    public reloadNeuroClient(url?: string, name?: string): void {
        this.neuro = new NeuroClient(url ?? 'ws://docker.internal:8000', name ?? 'Docker Desktop', this.onNeuroClientInit)
    }

    public reloadDockerClient(): void {
        this.loadDockerClient()
    }
}

export const CONT = new NoderontainerConstants()
