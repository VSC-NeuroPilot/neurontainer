import winston from 'winston';
import Transport from 'winston-transport'

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
                new winston.transports.File({ filename: `noderontainer-full-log-${getLogFileName()}.log`, zippedArchive: true }),
                new winston.transports.File({ filename: `noderontainer-error-log-${getLogFileName()}.log`, level: 'error' }),
                new winston.transports.Console({ stderrLevels: ['error', 'fatal'], consoleWarnLevels: ['warn'], level: 'info' }),
                new winston.transports.Http({ host: 'localhost', port: 5000 }),
            ]
        })
    }
}

class FrontendLogger extends Transport {
    constructor(opts: winston.transport.TransportStreamOptions) {
        super(opts)
    }
}
