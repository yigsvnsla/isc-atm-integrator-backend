import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAppConfig } from './config.interface';

/**
 * Typed configuration helper
 * Provides strongly-typed access to application configuration
 * All returned values are fully typed with TypeScript inference
 *
 * Usage in services:
 * ```typescript
 * @Injectable()
 * export class MyService {
 *   constructor(private readonly configHelper: ConfigHelper) {}
 *
 *   init() {
 *     const port = this.configHelper.getServerPort(); // ✅ number
 *     const redisHost = this.configHelper.getCacheRedisHost(); // ✅ string
 *   }
 * }
 * ```
 */
@Injectable()
export class ConfigHelper {
    private config: IAppConfig;

    constructor(private readonly configService: ConfigService) {
        this.config = this.configService.get<IAppConfig>('', {
            infer: true,
        }) as IAppConfig;
    }

    // Feature Flags
    shouldValidateBalance(): boolean {
        return this.config.features.validateBalance;
    }

    // App Settings
    isDevMode(): boolean {
        return this.config.app.isDevMode;
    }

    // Server Configuration
    getServerPort(): number {
        return this.config.server.port;
    }

    getServerPrefix(): string {
        return this.config.server.prefix;
    }

    getCorsOrigin(): string {
        return this.config.server.cors.origin;
    }

    getCorsMethods(): string {
        return this.config.server.cors.methods;
    }

    getCorsCredentials(): boolean {
        return this.config.server.cors.credentials;
    }

    // Cache Configuration
    getCacheRedisHost(): string {
        return this.config.cache.redis.host;
    }

    getCacheRedisTtl(): number {
        return this.config.cache.redis.ttl;
    }

    // Database Configuration
    getDatabaseHost(): string {
        return this.config.database.postgres.host;
    }

    getDatabasePort(): number {
        return this.config.database.postgres.port;
    }

    getDatabaseUsername(): string {
        return this.config.database.postgres.username;
    }

    getDatabasePassword(): string {
        return this.config.database.postgres.password;
    }

    getDatabaseName(): string {
        return this.config.database.postgres.name;
    }

    getDatabaseSynchronize(): boolean {
        return this.config.database.postgres.synchronize;
    }

    getMigrationsDir(): string {
        return this.config.database.migrations.dir;
    }

    getMigrationsTableName(): string {
        return this.config.database.migrations.tableName;
    }

    // Security - JWT
    getJwtSecret(): string {
        return this.config.security.jwt.secret;
    }

    getJwtExpiresIn(): string {
        return this.config.security.jwt.expiresIn;
    }

    getJwtRefreshExpiresIn(): number {
        return this.config.security.jwt.refreshExpiresIn;
    }

    // Security - CSRF
    isCsrfEnabled(): boolean {
        return this.config.security.csrf.enabled;
    }

    getCsrfSecret(): string {
        return this.config.security.csrf.secret;
    }

    getCsrfCookieName(): string {
        return this.config.security.csrf.cookieName;
    }

    // Seed Configuration
    getSeedAdminEmail(): string | undefined {
        return this.config.seed?.adminEmail;
    }

    getSeedAdminPassword(): string | undefined {
        return this.config.seed?.adminPassword;
    }

    // Direct access to entire config (if needed)
    getConfig(): IAppConfig {
        return this.config;
    }
}
