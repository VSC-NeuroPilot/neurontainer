import { NeuroClient } from 'neuro-game-sdk'
import { DockerClient } from '@docker/node-sdk'
import { Logger } from '../utils/logger'
import type { ActionData } from '../types/rce'
import { actions } from '../functions'
import { stripToActions } from '../utils/misc'
import { RCEActionHandler } from '../rce'

type NeuroEvent =
  | { type: 'connect_attempt'; at: number; url: string }
  | { type: 'connected'; at: number; url: string; ws: string }
  | { type: 'error'; at: number; url: string; ws: string; error: string }
  | { type: 'close'; at: number; url: string; ws: string; code: string; reason: string }
  | { type: 'reconnect_request'; at: number; requested: string; normalized: string; note?: string }
  | { type: 'reconnect_success'; at: number; url: string; ws: string }
  | { type: 'reconnect_fail'; at: number; requested: string; normalized: string; error: string }

class NoderontainerConstants {
  public neuro!: NeuroClient
  public docker!: DockerClient
  public logger: Logger

  public neuroConnected = false
  public currentNeuroUrl: string
  public neuroGeneration = 0
  public lastNeuroEvent: NeuroEvent | null = null
  public lastReconnectRequest: { requested: string; normalized: string; note?: string; at: number } | null = null

  private readonly GAME_NAME = 'neurontainer'
  private actionHandler: ((actionData: ActionData) => Promise<{ success: boolean; message: string }>) | null = null

  private loadDockerClient(): void {
    DockerClient.fromDockerConfig()
      .then((c) => (this.docker = c))
      .catch((e) => {
        console.error(e)
      })
  }

  constructor() {
    this.logger = new Logger()
    this.currentNeuroUrl = process.env.NEURO_SERVER_URL || 'ws://host.docker.internal:8000'
    this.loadDockerClient()
  }

  private describeWs(ws: any): string {
    if (!ws) return 'ws: none'
    const rs = typeof ws.readyState === 'number' ? ws.readyState : 'unknown'
    const url = ws.url ?? 'unknown'
    return `ws[url=${url}, readyState=${rs}]`
  }

  private errToString(err: unknown): string {
    if (err instanceof Error) return `${err.name}: ${err.message}`
    return typeof err === 'string' ? err : JSON.stringify(err)
  }

  private setLastNeuroEvent(e: NeuroEvent) {
    this.lastNeuroEvent = e
  }

  private registerNeuroActions() {
    this.neuro.registerActions(stripToActions(actions))
  }

  public initNeuro() {
    if (this.neuroConnected) return

    this.logger.info(`Trying Neuro server: ${this.currentNeuroUrl}`)
    this.setLastNeuroEvent({ type: 'connect_attempt', at: Date.now(), url: this.currentNeuroUrl })
    const gen = ++this.neuroGeneration

    this.neuro = new NeuroClient(this.currentNeuroUrl, this.GAME_NAME, () => {
      if (gen !== this.neuroGeneration) return
      this.neuroConnected = true
      const wsInfo = this.describeWs(this.neuro?.ws)
      this.logger.info(`Connected to Neuro-sama server at ${this.currentNeuroUrl} ${wsInfo}`)
      this.setLastNeuroEvent({ type: 'connected', at: Date.now(), url: this.currentNeuroUrl, ws: wsInfo })

      this.registerNeuroActions()

      // Handle actions from Neuro
      if (this.actionHandler) {
        this.neuro.onAction(async (actionData) => {
          const result = await this.actionHandler!(actionData)
          this.neuro.sendActionResult(actionData.id, result.success, result.message)
        })
      }

      // Send initial context to Neuro
      this.neuro.sendContext('neurontainer is now connected and ready to manage Docker containers', false)
    })

    const handleError = (errLabel: string, err?: unknown) => {
      if (gen !== this.neuroGeneration) return
      const wsInfo = this.describeWs(this.neuro?.ws)
      CONT.logger.error(`${errLabel} (url=${this.currentNeuroUrl}). ${wsInfo}`, err)
      this.setLastNeuroEvent({
        type: 'error',
        at: Date.now(),
        url: this.currentNeuroUrl,
        ws: wsInfo,
        error: this.errToString(err ?? errLabel)
      })
    }

    this.neuro.onError = (e) => {
      handleError('Neuro client error', e)
    }

    this.neuro.onClose = (e) => {
      if (gen !== this.neuroGeneration) return
      const code = e?.code ?? e?.kCode ?? 'unknown'
      const reason = e?.reason ?? e?.kReason ?? ''
      const wsInfo = this.describeWs(this.neuro?.ws)
      CONT.logger.warn(`Neuro client closed (code=${code}, reason=${reason}) url=${this.currentNeuroUrl}. ${wsInfo}`)
      this.setLastNeuroEvent({
        type: 'close',
        at: Date.now(),
        url: this.currentNeuroUrl,
        ws: wsInfo,
        code: String(code),
        reason: String(reason)
      })
    }
  }

  public normalizeNeuroUrl(input: string): { original: string; normalized: string; note?: string } {
    const original = input
    try {
      const u = new URL(input)
      let noteParts: string[] = []

      if ((u.protocol === 'ws:' || u.protocol === 'wss:') && !u.port) {
        u.port = '8000'
        noteParts.push('Added default port :8000 (ws/wss without explicit port defaults to :80)')
      }

      const note = noteParts.length ? noteParts.join('; ') : undefined
      return { original, normalized: u.toString(), note }
    } catch {
      return { original, normalized: input }
    }
  }

  public async waitForNeuroConnection(client: NeuroClient, url: string, timeoutMs = 6000): Promise<void> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const rs = client?.ws?.readyState
      if (rs === 1) return
      await new Promise((r) => setTimeout(r, 100))
    }
    throw new Error(
      `Timed out after ${timeoutMs}ms waiting for Neuro connection (${url}). ${this.describeWs(client?.ws)}`
    )
  }

  public async reconnectNeuro(websocketUrl: string): Promise<void> {
    // Close existing connection if present
    if (this.neuro) {
      try {
        if (this.neuro.ws && this.neuro.ws.readyState !== 3) {
          this.neuro.ws.close()
        }
      } catch (closeError) {
        console.warn('Error closing existing Neuro connection:', closeError)
      }
    }

    // Reset connection state
    this.neuroConnected = false
    this.currentNeuroUrl = websocketUrl
    const gen = ++this.neuroGeneration

    const client = new NeuroClient(this.currentNeuroUrl, this.GAME_NAME, () => {
      if (gen !== this.neuroGeneration) return
      this.neuroConnected = true
      const wsInfo = this.describeWs(client?.ws)
      console.log(`Reconnected to Neuro-sama server at ${this.currentNeuroUrl} ${wsInfo}`)
      this.setLastNeuroEvent({ type: 'connected', at: Date.now(), url: this.currentNeuroUrl, ws: wsInfo })

      this.registerNeuroActions()

      // Handle actions from Neuro
      this.neuro.onAction(RCEActionHandler)

      this.neuro.sendContext('neurontainer reconnected and ready to manage Docker containers', false)
    })
    this.neuro = client

      ; client.onError = (e) => {
        if (gen !== this.neuroGeneration) return
        const wsInfo = this.describeWs(client?.ws)
        CONT.logger.error(`Neuro client error (url=${this.currentNeuroUrl}). ${wsInfo}`, e)
        this.setLastNeuroEvent({ type: 'error', at: Date.now(), url: this.currentNeuroUrl, ws: wsInfo, error: this.errToString(e) })
      }

      ; client.onClose = (e) => {
        if (gen !== this.neuroGeneration) return
        const code = e?.code ?? e?.kCode ?? 'unknown'
        const reason = e?.reason ?? e?.kReason ?? ''
        const wsInfo = this.describeWs(client?.ws)
        CONT.logger.warn(`Neuro client closed (code=${code}, reason=${reason}) url=${this.currentNeuroUrl}. ${wsInfo}`)
        this.setLastNeuroEvent({
          type: 'close',
          at: Date.now(),
          url: this.currentNeuroUrl,
          ws: wsInfo,
          code: String(code),
          reason: String(reason)
        })
      }

    await this.waitForNeuroConnection(client, this.currentNeuroUrl, 6000)
  }

  public reloadDockerClient(): void {
    this.loadDockerClient()
  }
}

export const CONT = new NoderontainerConstants();

export const ERROR_MSG_REFERENCE = 'Someone tell the VSC-NeuroPilot crew there is a problem with their integration!';