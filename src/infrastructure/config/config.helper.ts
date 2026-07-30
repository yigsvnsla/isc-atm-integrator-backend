import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAppConfig } from './config.interface';

/**
 * Typed configuration helper
 * Provides strongly-typed access to application configuration
 *
 * For frequently-accessed or critical infrastructure values, use getter methods.
 * For less frequently accessed values, use the config property directly:
 *
 * Usage example:
 * ```typescript
 * @Injectable()
 * export class MyService {
 *   constructor(private readonly configHelper: ConfigHelper) {}
 *
 *   init() {
 *     // Critical infrastructure values - use getters
 *     const port = this.configHelper.getServerPort(); // ✅ number
 *     const jwtSecret = this.configHelper.getJwtSecret(); // ✅ string
 *
 *     // Less frequent access - use direct property access
 *     const corsOrigin = this.configHelper.config.server.cors.origin; // ✅ typed
 *     const devMode = this.configHelper.config.app.isDevMode; // ✅ typed
 *   }
 * }
 * ```
 */
@Injectable()
export class ConfigHelper {
    private appConfig: IAppConfig;

    constructor(private readonly configService: ConfigService) {
        this.appConfig = this.configService.get<IAppConfig>('', {
            infer: true,
        }) as IAppConfig;
    }

    /**
     * Direct access to entire configuration (typed)
     * Use for values not covered by dedicated getters
     */
    get config(): IAppConfig {
        return this.appConfig;
    }

    // === Critical Infrastructure Getters ===

    // Server Configuration
    getServerPort(): number {
        return this.appConfig.server.port;
    }

    getServerPrefix(): string {
        return this.appConfig.server.prefix;
    }

    // Cache Configuration
    getCacheRedisHost(): string {
        return this.appConfig.cache.redis.host;
    }

    getCacheRedisTtl(): number {
        return this.appConfig.cache.redis.ttl;
    }

    // Database Configuration (required for TypeORM setup)
    getDatabaseHost(): string {
        return this.appConfig.database.postgres.host;
    }

    getDatabasePort(): number {
        return this.appConfig.database.postgres.port;
    }

    getDatabaseUsername(): string {
        return this.appConfig.database.postgres.username;
    }

    getDatabasePassword(): string {
        return this.appConfig.database.postgres.password;
    }

    getDatabaseName(): string {
        return this.appConfig.database.postgres.name;
    }

    // Security - JWT (used throughout auth services)
    getJwtSecret(): string {
        return this.appConfig.security.jwt.secret;
    }

    getJwtExpiresIn(): string {
        return this.appConfig.security.jwt.expiresIn;
    }

    getJwtRefreshExpiresIn(): number {
        return this.appConfig.security.jwt.refreshExpiresIn;
    }

    // Security - CSRF (required for middleware)
    isCsrfEnabled(): boolean {
        return this.appConfig.security.csrf.enabled;
    }

    getCsrfSecret(): string {
        return this.appConfig.security.csrf.secret;
    }

    getCsrfCookieName(): string {
        return this.appConfig.security.csrf.cookieName;
    }
}
