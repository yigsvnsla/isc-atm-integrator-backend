import { IAppConfig } from './config.interface';

/**
 * Helper function to get environment variable with type safety guarantee
 * This tells TypeScript that the value is guaranteed to exist after Joi validation
 * If called outside of validation context, it will throw
 */
function getEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(
            `Environment variable ${key} is required but not provided. ` +
                `This should not happen if Joi validation is configured correctly.`,
        );
    }
    return value;
}

/**
 * Configuration factory function
 * Returns strongly-typed configuration object from validated environment variables
 *
 * Validation happens in app.module.ts via ConfigModule.forRoot({validationSchema})
 * If validation fails, the app will not start (error logged to console)
 */
export default (): IAppConfig => {
    // Note: By this point, all env vars have been validated by Joi
    // If we reach here, validation passed and vars are guaranteed to exist
    // (or have defaults from the schema)
    // The getEnv() helper ensures TypeScript knows values are non-null

    const nodeEnv = process.env.NODE_ENV ?? 'development';

    return {
        features: {
            validateBalance: process.env.FEATURE_VALIDATE_BALANCE === 'true',
        },

        app: {
            isDevMode: nodeEnv === 'development',
        },

        server: {
            port: parseInt(getEnv('APP_SERVER_PORT'), 10),
            prefix: getEnv('APP_SERVER_PREFIX'),
            cors: {
                origin: getEnv('APP_CORS_ORIGIN'),
                methods: getEnv('APP_CORS_METHODS'),
                credentials: process.env.APP_CORS_CREDENTIALS === 'true',
            },
        },

        cache: {
            redis: {
                host: getEnv('APP_CACHE_REDIS_HOST'),
                ttl: parseInt(getEnv('APP_CACHE_REDIS_TTL'), 10),
            },
        },

        database: {
            postgres: {
                host: getEnv('DB_HOST'),
                port: parseInt(getEnv('DB_PORT'), 10),
                username: getEnv('DB_USERNAME'),
                password: getEnv('DB_PASSWORD'),
                name: getEnv('DB_NAME'),
                synchronize: false,
            },
            migrations: {
                dir: getEnv('TYPEORM_MIGRATIONS_DIR'),
                tableName: getEnv('TYPEORM_MIGRATIONS_TABLE_NAME'),
            },
        },

        security: {
            jwt: {
                secret: getEnv('APP_JWT_SECRET'),
                expiresIn: getEnv('APP_JWT_EXPIRES_IN'),
                refreshExpiresIn: parseInt(
                    getEnv('APP_JWT_REFRESH_EXPIRES_IN'),
                    10,
                ),
            },
            csrf: {
                enabled: process.env.APP_CSRF_ENABLED === 'true',
                secret: getEnv('APP_CSRF_SECRET'),
                cookieName: getEnv('APP_CSRF_COOKIE'),
            },
        },

        ...(process.env.APP_SEED_ADMIN_EMAIL &&
            process.env.APP_SEED_ADMIN_PASSWORD && {
                seed: {
                    adminEmail: getEnv('APP_SEED_ADMIN_EMAIL'),
                    adminPassword: getEnv('APP_SEED_ADMIN_PASSWORD'),
                },
            }),
    };
};
