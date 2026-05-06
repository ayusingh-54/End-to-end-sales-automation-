import pino, { type LoggerOptions } from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

const opts: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'scraper' },
};

if (isDev) {
  opts.transport = {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
  };
}

export const logger = pino(opts);
