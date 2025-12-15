import winston from 'winston';
import Transport from 'winston-transport'
import path from 'node:path'
import fs from 'node:fs'

const LOG_DIR = '/data/logs'

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
}

function getLogFileName() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

export class Logger {
    private logger: winston.Logger;
    constructor() {
        this.logger = winston.createLogger({
            level: 'debug',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            defaultMeta: { service: 'neurontainer' },
            transports: [
                new winston.transports.File({
                    filename: path.join(LOG_DIR, `neurontainer-full-${getLogFileName()}.log`),
                    zippedArchive: true
                }),
                new winston.transports.File({
                    filename: path.join(LOG_DIR, `neurontainer-error-${getLogFileName()}.log`),
                    level: 'error'
                }),
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    ),
                    stderrLevels: ['error', 'fatal'],
                    consoleWarnLevels: ['warn'],
                    level: 'info'
                }),
            ]
        })
    }

    public info(message: string, ...meta: any[]): void {
        this.logger.info(message, ...meta)
    }

    public error(message: string, ...meta: any[]): void {
        this.logger.error(message, ...meta)
    }

    public warn(message: string, ...meta: any[]): void {
        this.logger.warn(message, ...meta)
    }

    public debug(message: string, ...meta: any[]): void {
        this.logger.debug(message, ...meta)
    }

    public addTransport(...transport: Transport[]): this {
        this.logger.transports.push(...transport)
        return this
    }

    public exportLogs(): void { }
}

class FrontendLogger extends Transport {
    constructor(opts: winston.transport.TransportStreamOptions) {
        super(opts)
    }
}

// Export a singleton instance
export const logger = new Logger()
