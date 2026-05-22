import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PRODUCTS_PORT: Joi.number().port().default(3002),
  PORT: Joi.number().port().optional(),

  MONGO_URI: Joi.string().uri({ scheme: ['mongodb', 'mongodb+srv'] }).required(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ISSUER: Joi.string().default('peaku-auth'),
  JWT_AUDIENCE: Joi.string().default('peaku-api'),

  CORS_ORIGINS: Joi.string().default('http://localhost:4200'),
  THROTTLE_TTL_MS: Joi.number().integer().min(1000).default(60_000),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(60),

  SWAGGER_ENABLED: Joi.string().valid('true', 'false').default('true'),
  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace').default('info'),

  INTERNAL_API_KEY: Joi.string().min(16).optional(),
}).unknown(true);
