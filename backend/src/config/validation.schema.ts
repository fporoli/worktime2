import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().required(),
  DATABASE_SCHEMA: Joi.string().default('app'),
  KEYCLOAK_ISSUER_URL: Joi.string().uri().required(),
  KEYCLOAK_INTERNAL_ISSUER_URL: Joi.string().uri().optional(),
  FRONTEND_ORIGIN: Joi.string().uri().required(),
});
