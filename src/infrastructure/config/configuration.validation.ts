import * as Joi from 'joi';

/**
 * Joi validation schema for environment variables
 * Validates and transforms env vars at application startup
 *
 * Required variables will fail fast if missing
 * Optional variables (like feature flags and seed config) are allowed to be undefined
 *
 * All numeric values are specified to handle string env vars properly
 */
export const createValidationSchema = () => {
    return Joi.object({
        // Features
        FEATURE_VALIDATE_BALANCE: Joi.boolean().default(true),

        // Server Configuration
        APP_SERVER_PORT: Joi.number().port().required().messages({
            'number.port': 'APP_SERVER_PORT must be a valid port number',
            'any.required': 'APP_SERVER_PORT is required',
        }),
        APP_SERVER_PREFIX: Joi.string().required().messages({
            'any.required': 'APP_SERVER_PREFIX is required (e.g., /api)',
        }),

        // CORS Configuration
        APP_CORS_ORIGIN: Joi.string().required().messages({
            'any.required':
                'APP_CORS_ORIGIN is required (e.g., * or specific domain)',
        }),
        APP_CORS_METHODS: Joi.string().required().messages({
            'any.required': 'APP_CORS_METHODS is required',
        }),
        APP_CORS_CREDENTIALS: Joi.boolean().default(false),

        // Redis Cache Configuration
        APP_CACHE_REDIS_HOST: Joi.string().required().messages({
            'any.required':
                'APP_CACHE_REDIS_HOST is required (e.g., redis://localhost:6379)',
        }),
        APP_CACHE_REDIS_TTL: Joi.number().min(0).required().messages({
            'number.min': 'APP_CACHE_REDIS_TTL must be >= 0',
            'any.required': 'APP_CACHE_REDIS_TTL is required',
        }),

        // Database Configuration
        DB_HOST: Joi.string().required().messages({
            'any.required': 'DB_HOST is required',
        }),
        DB_PORT: Joi.number().port().required().messages({
            'number.port': 'DB_PORT must be a valid port number',
            'any.required': 'DB_PORT is required',
        }),
        DB_USERNAME: Joi.string().required().messages({
            'any.required': 'DB_USERNAME is required',
        }),
        DB_PASSWORD: Joi.string().required().messages({
            'any.required': 'DB_PASSWORD is required',
        }),
        DB_NAME: Joi.string().required().messages({
            'any.required': 'DB_NAME is required',
        }),

        // Database Migrations
        TYPEORM_MIGRATIONS_DIR: Joi.string().required().messages({
            'any.required': 'TYPEORM_MIGRATIONS_DIR is required',
        }),
        TYPEORM_MIGRATIONS_TABLE_NAME: Joi.string().required().messages({
            'any.required': 'TYPEORM_MIGRATIONS_TABLE_NAME is required',
        }),

        // JWT Security
        APP_JWT_SECRET: Joi.string().min(10).required().messages({
            'string.min': 'APP_JWT_SECRET should be at least 10 characters',
            'any.required': 'APP_JWT_SECRET is required',
        }),
        APP_JWT_EXPIRES_IN: Joi.string().required().messages({
            'any.required': 'APP_JWT_EXPIRES_IN is required (e.g., 15m)',
        }),
        APP_JWT_REFRESH_EXPIRES_IN: Joi.number().min(0).required().messages({
            'number.min': 'APP_JWT_REFRESH_EXPIRES_IN must be >= 0',
            'any.required': 'APP_JWT_REFRESH_EXPIRES_IN is required',
        }),

        // CSRF Protection
        APP_CSRF_ENABLED: Joi.boolean().default(true),
        APP_CSRF_SECRET: Joi.string().min(10).required().messages({
            'string.min': 'APP_CSRF_SECRET should be at least 10 characters',
            'any.required': 'APP_CSRF_SECRET is required',
        }),
        APP_CSRF_COOKIE: Joi.string().required().messages({
            'any.required': 'APP_CSRF_COOKIE is required',
        }),

        // Seeding Configuration (optional - only used for initial data)
        APP_SEED_ADMIN_EMAIL: Joi.string().optional().allow(''),
        APP_SEED_ADMIN_PASSWORD: Joi.string().optional().allow(''),

        // Environment (optional, defaults to 'development')
        NODE_ENV: Joi.string()
            .valid('development', 'production', 'test')
            .default('development'),
    })
        .unknown(true) // Allow other env vars not listed here
        .messages({
            'object.unknown': 'Unknown environment variable: {#key}',
        });
};

/**
 * Export for compatibility with ConfigModule.forRoot()
 */
export const configValidationSchema = createValidationSchema();
