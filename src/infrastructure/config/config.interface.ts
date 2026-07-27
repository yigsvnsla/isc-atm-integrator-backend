/**
 * Type-safe configuration interface
 * Matches the Joi validation schema to provide TypeScript type safety
 */
export interface IAppConfig {
    features: {
        validateBalance: boolean;
    };
    app: {
        isDevMode: boolean;
    };
    server: {
        port: number;
        prefix: string;
        cors: {
            origin: string;
            methods: string;
            credentials: boolean;
        };
    };
    cache: {
        redis: {
            host: string;
            ttl: number;
        };
    };
    database: {
        postgres: {
            host: string;
            port: number;
            username: string;
            password: string;
            name: string;
            synchronize: boolean;
        };
        migrations: {
            dir: string;
            tableName: string;
        };
    };
    security: {
        jwt: {
            secret: string;
            expiresIn: string;
            refreshExpiresIn: number;
        };
        csrf: {
            enabled: boolean;
            secret: string;
            cookieName: string;
        };
    };
    seed?: {
        adminEmail: string;
        adminPassword: string;
    };
}
