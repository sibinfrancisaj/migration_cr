import winston from 'winston';

const { combine, timestamp, json, colorize, simple, errors } = winston.format;

const isDev = process.env['NODE_ENV'] !== 'production';

export const logger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  format: combine(
    errors({ stack: true }),
    timestamp(),
    isDev ? combine(colorize(), simple()) : json(),
  ),
  defaultMeta: {
    service: process.env['OTEL_SERVICE_NAME'] ?? 'abroad-matrimony',
    env: process.env['NODE_ENV'] ?? 'development',
  },
  transports: [new winston.transports.Console()],
  exitOnError: false,
});

export function createChildLogger(context: Record<string, unknown>): winston.Logger {
  return logger.child(context);
}

export type Logger = winston.Logger;
