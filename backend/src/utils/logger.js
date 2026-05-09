const winston = require('winston');
const path = require('path');

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ level, message, timestamp, stack }) => {
        return `${timestamp} ${level}: ${stack || message}`;
      })
    )
  })
];

// Only add file transports if NOT in production (avoid EROFS on Vercel)
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.File({ 
      filename: path.join(__dirname, '../../backend.log'),
      level: 'info'
    }),
    new winston.transports.File({ 
      filename: path.join(__dirname, '../../error.log'), 
      level: 'error' 
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports
});

module.exports = logger;

