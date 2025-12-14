import winston from 'winston';
import Transport from 'winston-transport'
import path from 'node:path'

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
            format: winston.format.json(),
            defaultMeta: { service: 'user-service' },
            transports: [
                new winston.transports.File({ filename: path.join(process.env.SERVER_ENVIRONMENT ? process.cwd() : '', `/data/noderontainer-full-log-${getLogFileName()}.log`), zippedArchive: true }),
                new winston.transports.File({ filename: path.join(process.env.SERVER_ENVIRONMENT ? process.cwd() : '', `/data/noderontainer-error-log-${getLogFileName()}.log`), level: 'error' }),
                new winston.transports.Console({ stderrLevels: ['error', 'fatal'], consoleWarnLevels: ['warn'], level: 'info' }),
            ]
        })
    }
}

class FrontendLogger extends Transport {
    constructor(opts: winston.transport.TransportStreamOptions) {
        super(opts)
    }
}
