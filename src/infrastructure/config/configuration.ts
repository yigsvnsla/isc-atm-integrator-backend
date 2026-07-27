import { IAppConfig } from './config.interface';

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

    const nodeEnv = process.env.NODE_ENV ?? 'development';

    return {
        features: {
            validateBalance: process.env.FEATURE_VALIDATE_BALANCE === 'true',
        },

        app: {
            isDevMode: nodeEnv === 'development',
        },

        server: {
            port: parseInt(String(process.env.APP_SERVER_PORT), 10),
            prefix: String(process.env.APP_SERVER_PREFIX),
            cors: {
                origin: String(process.env.APP_CORS_ORIGIN),
                methods: String(process.env.APP_CORS_METHODS),
                credentials: process.env.APP_CORS_CREDENTIALS === 'true',
            },
        },

        cache: {
            redis: {
                host: String(process.env.APP_CACHE_REDIS_HOST),
                ttl: parseInt(String(process.env.APP_CACHE_REDIS_TTL), 10),
            },
        },

        database: {
            postgres: {
                host: String(process.env.DB_HOST),
                port: parseInt(String(process.env.DB_PORT), 10),
                username: String(process.env.DB_USERNAME),
                password: String(process.env.DB_PASSWORD),
                name: String(process.env.DB_NAME),
                synchronize: false,
            },
            migrations: {
                dir: String(process.env.TYPEORM_MIGRATIONS_DIR),
                tableName: String(process.env.TYPEORM_MIGRATIONS_TABLE_NAME),
            },
        },

        security: {
            jwt: {
                secret: String(process.env.APP_JWT_SECRET),
                expiresIn: String(process.env.APP_JWT_EXPIRES_IN),
                refreshExpiresIn: parseInt(
                    String(process.env.APP_JWT_REFRESH_EXPIRES_IN),
                    10,
                ),
            },
            csrf: {
                enabled: process.env.APP_CSRF_ENABLED === 'true',
                secret: String(process.env.APP_CSRF_SECRET),
                cookieName: String(process.env.APP_CSRF_COOKIE),
            },
        },

        ...(process.env.APP_SEED_ADMIN_EMAIL &&
            process.env.APP_SEED_ADMIN_PASSWORD && {
                seed: {
                    adminEmail: String(process.env.APP_SEED_ADMIN_EMAIL),
                    adminPassword: String(process.env.APP_SEED_ADMIN_PASSWORD),
                },
            }),
    };
};
