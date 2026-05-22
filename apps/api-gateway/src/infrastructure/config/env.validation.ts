import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  GATEWAY_PORT: Joi.number().port().default(4050),
  PORT: Joi.number().port().optional(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ISSUER: Joi.string().default('peaku-auth'),
  JWT_AUDIENCE: Joi.string().default('peaku-api'),

  AUTH_SERVICE_URL: Joi.string().uri().required(),
  PRODUCTS_SERVICE_URL: Joi.string().uri().required(),
  INTERNAL_API_KEY: Joi.string().min(16).required(),

  CORS_ORIGINS: Joi.string().default('http://localhost:4200'),
  THROTTLE_TTL_MS: Joi.number().integer().min(1000).default(60_000),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(60),
  AUTH_THROTTLE_LIMIT: Joi.number().integer().min(1).default(10),

  SWAGGER_ENABLED: Joi.string().valid('true', 'false').default('true'),
  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace').default('info'),
}).unknown(true);
