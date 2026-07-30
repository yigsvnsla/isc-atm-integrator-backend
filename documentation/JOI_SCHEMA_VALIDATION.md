# Environment Validation & Typed Configuration

## Overview

This project implements **environment variable validation at application startup** using Joi, combined with a **typed configuration helper** for safe, IDE-friendly access to configuration throughout your application.

### Why This Approach?

**Before Validation (Unsafe)**
```typescript
const port = process.env.APP_SERVER_PORT;  // string | undefined
const host = process.env.DB_HOST;  // string | undefined
if (!port) throw new Error('...');  // Defensive checks everywhere
```

**After Validation + ConfigHelper (Safe)**
```typescript
const port = this.configHelper.getServerPort();  // number (guaranteed)
const host = this.configHelper.getDatabaseHost();  // string (guaranteed)
// No undefined checks needed - Joi validates at startup
```

Benefits:
- ✅ **Fast-fail startup** - Missing env vars caught immediately, not mid-request
- ✅ **Type-safe** - TypeScript knows exact types, no `undefined` in return values
- ✅ **Centralized validation** - All rules in one schema, no scattered checks
- ✅ **IDE support** - IntelliSense shows all available config methods
- ✅ **Production-ready** - Fails fast on misconfiguration

---

## Architecture

### Files Involved

```
src/infrastructure/config/
├── config.interface.ts                 # IAppConfig type definition
├── configuration.validation.ts         # Joi schema with validation rules
├── configuration.ts                    # Config factory + getEnv() helper
├── config.helper.ts                    # ConfigHelper service (typed access)
└── config-validation.error.ts          # Error handling utility

src/app.module.ts                       # ConfigModule setup + ConfigHelper provider
```

### How It Works

```
.env file
   ↓
ConfigModule.forRoot() reads env vars
   ↓
Joi Schema validates all variables (configuration.validation.ts)
   ↓
Type coercion (string → number, boolean)
   ↓
Configuration factory builds typed object (configuration.ts)
   ↓
ConfigHelper service provides typed getters (config.helper.ts)
   ↓
Services/Controllers inject ConfigHelper and use typed methods
```

---

## 1. Joi Validation Schema

### File: `configuration.validation.ts`

Defines validation rules for all environment variables required by the application.

#### Key Features

- **Required Variables** - Must be present or app fails at startup
- **Optional Variables** - Can be missing (seed config, feature flags)
- **Type Validation** - Ensures correct types (number, string, boolean)
- **Custom Messages** - Clear error messages for validation failures
- **Type Coercion** - Converts string env vars to proper types via `convert: true`

#### Validation Rules Table

| Variable | Type | Required | Rules | Purpose |
|----------|------|----------|-------|---------|
| `APP_SERVER_PORT` | number | ✅ | Valid port (0-65535) | Server listening port |
| `APP_SERVER_PREFIX` | string | ✅ | Non-empty | API endpoint prefix |
| `APP_CORS_ORIGIN` | string | ✅ | Non-empty | CORS origin |
| `APP_CORS_METHODS` | string | ✅ | Non-empty | CORS methods |
| `APP_CORS_CREDENTIALS` | boolean | ❌ | N/A | CORS credentials (default: false) |
| `APP_CACHE_REDIS_HOST` | string | ✅ | Non-empty | Redis URI |
| `APP_CACHE_REDIS_TTL` | number | ✅ | ≥ 0 | Cache TTL (ms) |
| `DB_HOST` | string | ✅ | Non-empty | Database hostname |
| `DB_PORT` | number | ✅ | Valid port | Database port |
| `DB_USERNAME` | string | ✅ | Non-empty | Database user |
| `DB_PASSWORD` | string | ✅ | Non-empty | Database password |
| `DB_NAME` | string | ✅ | Non-empty | Database name |
| `TYPEORM_MIGRATIONS_DIR` | string | ✅ | Non-empty | Migrations directory |
| `TYPEORM_MIGRATIONS_TABLE_NAME` | string | ✅ | Non-empty | Migrations table name |
| `APP_JWT_SECRET` | string | ✅ | Min 10 chars | JWT signing secret |
| `APP_JWT_EXPIRES_IN` | string | ✅ | Non-empty | JWT expiration (e.g., "15m") |
| `APP_JWT_REFRESH_EXPIRES_IN` | number | ✅ | ≥ 0 | Refresh token TTL (seconds) |
| `APP_CSRF_ENABLED` | boolean | ❌ | N/A | CSRF protection (default: true) |
| `APP_CSRF_SECRET` | string | ✅ | Min 10 chars | CSRF token secret |
| `APP_CSRF_COOKIE` | string | ✅ | Non-empty | CSRF cookie name |
| `APP_SEED_ADMIN_EMAIL` | string | ❌ | Non-empty string | Initial admin email |
| `APP_SEED_ADMIN_PASSWORD` | string | ❌ | Non-empty string | Initial admin password |
| `FEATURE_VALIDATE_BALANCE` | boolean | ❌ | N/A | Feature flag (default: true) |
| `NODE_ENV` | string | ❌ | 'development'/'production'/'test' | Environment (default: 'development') |

#### Example Schema Rule

```typescript
APP_JWT_SECRET: Joi.string().min(10).required().messages({
  'string.min': 'APP_JWT_SECRET should be at least 10 characters',
  'any.required': 'APP_JWT_SECRET is required',
}),
```

---

## 2. Type-Safe Configuration Interface

### File: `config.interface.ts`

Defines the TypeScript type for your entire configuration object:

```typescript
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
```

This interface ensures TypeScript can infer exact types when accessing config values.

---

## 3. Configuration Factory with Type Guarantee

### File: `configuration.ts`

Transforms validated environment variables into a structured `IAppConfig` object:

```typescript
function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is required but not provided`);
  }
  return value;
}

export default (): IAppConfig => {
  return {
    server: {
      port: parseInt(getEnv('APP_SERVER_PORT'), 10),  // ✅ Returns number, never undefined
      prefix: getEnv('APP_SERVER_PREFIX'),             // ✅ Returns string, never undefined
      // ... more config
    },
    // ... rest
  };
};
```

**Key insight**: The `getEnv()` helper tells TypeScript that values are guaranteed to exist after Joi validation. No more `string | undefined` warnings!

---

## 4. ConfigHelper Service for Easy Access

### File: `config.helper.ts`

Provides typed access to critical infrastructure configuration values. Two approaches:

1. **Dedicated getters** for frequently-accessed values (startup, security)
2. **Direct property access** via `.config` for everything else (maintains full type safety)

```typescript
@Injectable()
export class ConfigHelper {
  private appConfig: IAppConfig;

  constructor(private readonly configService: ConfigService) {
    this.appConfig = this.configService.get<IAppConfig>('', { infer: true }) as IAppConfig;
  }

  // Direct access to entire config (typed)
  get config(): IAppConfig {
    return this.appConfig;
  }

  // Critical infrastructure getters
  getServerPort(): number { return this.appConfig.server.port; }
  getCacheRedisHost(): string { return this.appConfig.cache.redis.host; }
  getDatabaseHost(): string { return this.appConfig.database.postgres.host; }
  getJwtSecret(): string { return this.appConfig.security.jwt.secret; }
  // ... more critical getters
}
```

**Design**: Reduces boilerplate while keeping infrastructure values protected from refactoring.

---

## Integration with NestJS

### File: `app.module.ts`

```typescript
import { ConfigHelper } from '@infrastructure/config/config.helper';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
      cache: true,
      validationSchema: configValidationSchema,
      validationOptions: {
        abortEarly: true,      // Fail on first error (fast-fail)
        allowUnknown: true,    // Allow extra env vars
        convert: true,         // String → Number, Boolean conversion
      },
    }),
    // ... other modules
  ],
  providers: [
    ConfigHelper,  // Make globally available
    // ... other providers
  ],
})
export class AppModule {}
```

### Validation Options Explained

| Option | Value | Effect |
|--------|-------|--------|
| `validationSchema` | Joi schema | Applies validation rules to all env vars |
| `abortEarly` | `true` | Stops at first error (fail fast) |
| `allowUnknown` | `true` | Permits env vars not listed in schema |
| `convert` | `true` | Automatically converts "3000" → 3000, "true" → true |
| `isGlobal` | `true` | ConfigModule available to all modules |
| `cache` | `true` | Cache validated config in memory |

---

## Usage Patterns

### Pattern 1: Using ConfigHelper in Services

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigHelper } from '@infrastructure/config/config.helper';

@Injectable()
export class DatabaseService {
  constructor(private readonly configHelper: ConfigHelper) {}

  getConnectionConfig() {
    // Critical infrastructure - use dedicated getters
    return {
      host: this.configHelper.getDatabaseHost(),           // ✅ string
      port: this.configHelper.getDatabasePort(),           // ✅ number
      username: this.configHelper.getDatabaseUsername(),   // ✅ string
      password: this.configHelper.getDatabasePassword(),   // ✅ string
      database: this.configHelper.getDatabaseName(),       // ✅ string
    };
  }

  isProduction() {
    // Less critical - direct property access (still typed!)
    return !this.configHelper.config.app.isDevMode;  // ✅ boolean
  }
}
```

### Pattern 2: Using ConfigHelper in Controllers

```typescript
import { Controller, Get } from '@nestjs/common';
import { ConfigHelper } from '@infrastructure/config/config.helper';

@Controller('info')
export class InfoController {
  constructor(private readonly configHelper: ConfigHelper) {}

  @Get('server')
  getServerInfo() {
    return {
      // Critical values - use getters
      port: this.configHelper.getServerPort(),        // ✅ number
      prefix: this.configHelper.getServerPrefix(),    // ✅ string
      
      // Less critical - direct property access (still typed!)
      isDev: this.configHelper.config.app.isDevMode,           // ✅ boolean
      corsOrigin: this.configHelper.config.server.cors.origin, // ✅ string
      corsCredentials: this.configHelper.config.server.cors.credentials,  // ✅ boolean
    };
  }
}
```

### Pattern 3: Direct Config Property Access

For less frequently accessed values, use the `.config` property for clean, typed access:

```typescript
// Accessing nested config values directly (all fully typed)
const corsConfig = this.configHelper.config.server.cors;         // ✅ typed
const seedEmail = this.configHelper.config.seed?.adminEmail;     // ✅ typed
const migDir = this.configHelper.config.database.migrations.dir;  // ✅ typed

// TypeScript knows exact types at each level
console.log(corsConfig.origin);  // TypeScript: string
console.log(corsConfig.credentials);  // TypeScript: boolean
```

---

## Validation at Startup

### Successful Startup

All env vars are valid, app starts normally:

```
[Nest] 29252  - 07/26/2026, 2:59:09 AM     LOG [NestFactory] Starting Nest application...
[Nest] 29252  - 07/26/2026, 2:59:10 AM     LOG [InstanceLoader] DatabaseModule dependencies initialized
[Nest] 29252  - 07/26/2026, 2:59:12 AM     LOG [InstanceLoader] HealthModule dependencies initialized
[Nest] 29252  - 07/26/2026, 2:59:13 AM     LOG [NestApplication] Nest application successfully started
```

### Validation Error

Missing or invalid env var stops the app:

```
[Nest] 14900  - 07/26/2026, 2:41:33 AM   ERROR [ExceptionHandler] 
"APP_SERVER_PORT" must be a valid port number
```

This forces developers to fix the environment before the app can run—far better than a runtime crash mid-request!

---

## Common Issues & Solutions

### Issue: `string | undefined` Still Shows in TypeScript

**Problem**: Hovering over env var access shows `string | undefined`

**Solution**: Use `getEnv()` helper instead of direct `process.env` access:
```typescript
// ❌ Wrong - TypeScript sees string | undefined
const port = String(process.env.APP_SERVER_PORT);

// ✅ Correct - TypeScript sees string (guaranteed)
const port = getEnv('APP_SERVER_PORT');
```

### Issue: Numbers Are Still Strings

**Problem**: `DB_PORT` comes as "5432" string instead of 5432 number

**Solution**: Ensure `convert: true` in `validationOptions` and use `parseInt()`:
```typescript
validationOptions: {
  convert: true,  // This enables automatic type coercion
}

// In configuration.ts:
port: parseInt(getEnv('DB_PORT'), 10),  // Also explicitly convert
```

### Issue: Optional Variables Fail Validation

**Problem**: `APP_SEED_ADMIN_EMAIL` causes error even though marked optional

**Solution**: Use `.optional().allow('')`:
```typescript
APP_SEED_ADMIN_EMAIL: Joi.string().optional().allow(''),
```

### Issue: `.email()` Validation Too Strict

**Problem**: `.email()` rejects `admin@atm-integrator.local`

**Solution**: Use generic `.string()` for internal emails:
```typescript
APP_SEED_ADMIN_EMAIL: Joi.string().optional().allow(''),  // Accepts any string
```

---

## Best Practices

### 1. Keep Critical Infrastructure Values Synchronized

When adding a **critical infrastructure** value (server config, database credentials, JWT, CSRF):
1. Add to `.env` file with example value
2. Add Joi validation rule to `configuration.validation.ts`
3. Add field to `IAppConfig` interface in `config.interface.ts`
4. Add to config factory in `configuration.ts` using `getEnv()`
5. Add typed **getter method** to `ConfigHelper` service

For **non-critical** values (feature flags, app settings, CORS details):
- Steps 1-4 above still apply
- No getter method needed—access directly via `configHelper.config.*`

### 2. Use Meaningful Error Messages

```typescript
APP_JWT_SECRET: Joi.string().min(10).required().messages({
  'string.min': 'APP_JWT_SECRET must be at least 10 characters (use a strong secret)',
  'any.required': 'APP_JWT_SECRET is required for security. Generate one: openssl rand -base64 32',
}),
```

### 3. Mark Optional Variables Clearly

```typescript
// Optional - can be omitted or empty
FEATURE_VALIDATE_BALANCE: Joi.boolean().default(true),
APP_SEED_ADMIN_EMAIL: Joi.string().optional().allow(''),

// Required - will fail if missing or invalid
APP_SERVER_PORT: Joi.number().port().required(),
DB_HOST: Joi.string().required(),
```

### 4. Always Use ConfigHelper for Config Access

Never access `process.env` directly in services/controllers:

```typescript
// ❌ Bad - untyped, requires defensive checks
const port = parseInt(process.env.APP_SERVER_PORT || '3000', 10);

// ✅ Good - typed, guaranteed to exist (critical infrastructure)
const port = this.configHelper.getServerPort();

// ✅ Good - typed, direct property access (less critical)
const isDev = this.configHelper.config.app.isDevMode;
```

### 5. Access Patterns: Getters vs. Direct Properties

**Use dedicated getters** for critical infrastructure values:
- Server port/prefix (startup config)
- Database credentials (connection setup)
- JWT secrets (auth setup)
- CSRF config (middleware setup)
- Redis host/TTL (cache setup)

**Use direct property access** (`.config.*`) for everything else:
- Feature flags (`config.features.*`)
- App mode settings (`config.app.*`)
- CORS details (`config.server.cors.*`)
- Migrations config (`config.database.migrations.*`)
- Seed configuration (`config.seed.*`)

This keeps the helper focused while maintaining full type safety:

```typescript
// ✅ Critical infrastructure - use getters
const secret = this.configHelper.getJwtSecret();

// ✅ Everything else - direct property access
const corsOrigin = this.configHelper.config.server.cors.origin;
const shouldValidate = this.configHelper.config.features.validateBalance;
```

---

## Type Safety Guarantee

✅ **All returned values are guaranteed to be defined** because:

1. **Joi validates at startup** - Missing or invalid env vars cause immediate app failure
2. **IAppConfig interface** enforces structure and types
3. **getEnv() helper** tells TypeScript values are non-null
4. **ConfigHelper methods** all return concrete types (number, string, boolean)

This means:
- No more `undefined` errors at runtime
- TypeScript catches type mismatches at compile time
- IDE provides full IntelliSense support
- Configuration is guaranteed valid from app start to shutdown

---

## Migration from Unsafe Patterns

### Old Way (Scattered, Unsafe)
```typescript
// Utils scattered throughout codebase
function getPort(): number {
  const port = process.env.APP_SERVER_PORT;
  if (!port) throw new Error('APP_SERVER_PORT missing');
  return parseInt(port, 10);
}

function getDbHost(): string {
  const host = process.env.DB_HOST;
  if (!host) throw new Error('DB_HOST missing');
  return host;
}
```

### New Way (Centralized, Safe)
```typescript
// Single ConfigHelper with all getters
@Injectable()
export class ConfigHelper {
  getServerPort(): number { /* ... */ }
  getDatabaseHost(): string { /* ... */ }
  // All in one place, all typed, all validated at startup
}
```

Benefits:
- Validation happens once at startup (not per method call)
- Single source of truth for all config
- Full type safety across entire app
- Easy to test (inject ConfigHelper mock)

---

## Troubleshooting

### "App won't start - validation error"

1. Read the error message - it specifies which env var failed
2. Check `.env` file - is the variable present?
3. Verify the value matches validation rules (e.g., port is 0-65535)
4. Check Joi schema - is the type correct?

### "ConfigHelper returns undefined"

This shouldn't happen if validation passed, but if it does:
1. Verify the getter method exists in ConfigHelper
2. Check the config structure matches `IAppConfig` interface
3. Ensure the env var is in the validation schema

### "IDE doesn't show IntelliSense"

1. Check ConfigHelper is injected correctly
2. Verify `@Injectable()` decorator is on ConfigHelper
3. Restart VS Code language server (Cmd+Shift+P → "Reload Window")
4. Check that method names match what you're typing

---

## Summary

This complete validation and typed configuration system provides:

✅ **Fail-fast startup validation** - Missing/invalid env vars caught immediately  
✅ **Full TypeScript type safety** - No `undefined` errors, IDE autocomplete at every level  
✅ **Centralized validation** - All validation rules in one schema file  
✅ **Reduced boilerplate** - Focused helper methods only for critical infrastructure  
✅ **Direct property access** - Type-safe access to all config without getter methods  
✅ **Production-ready** - Guaranteed configuration validity  
✅ **Maintainable** - Single source of truth, clear separation of concerns  

### Why This Design?

**Problem**: Too many getter methods made the helper bloated and maintenance-heavy. Every new config value required a new getter method.

**Solution**: 
- Dedicated getters only for **critical infrastructure values** (startup-critical, security-sensitive)
- Direct property access (`.config.*`) for **everything else**, still fully typed via `IAppConfig` interface

This strikes a balance:
- Infrastructure values are protected by explicit getters (refactoring-safe)
- Flexibility for application-level config (feature flags, app settings)
- All access is fully typed (no TypeScript `any`)
- Minimal boilerplate

By combining Joi validation with a lightweight ConfigHelper, your application has rock-solid configuration that's safe, typed, maintainable, and easy to use throughout your codebase.
