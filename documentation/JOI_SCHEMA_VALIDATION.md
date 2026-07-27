# Joi Schema Validation Setup

## Overview

This project implements **environment variable validation at application startup** using Joi, a powerful schema validation library integrated with NestJS ConfigModule. This ensures that all required environment variables are present, properly typed, and validated before the application initializes.

## Why Joi Validation?

Before implementing Joi validation, environment variables were read directly without validation, leading to potential runtime errors:
- **Missing variables** could cause crashes mid-request instead of at startup
- **Type mismatches** (string "3000" vs number 3000) caused implicit conversions
- **No centralized requirements** - validation logic scattered throughout codebase
- **Undefined errors** in TypeScript despite seemingly optional checks

With Joi validation:
- ✅ **Fast-fail startup** - missing env vars caught immediately
- ✅ **Type-safe** - ConfigService knows exact types
- ✅ **Centralized** - all validation rules in one schema
- ✅ **No defensive checks** - guaranteed values, no null checks needed

---

## Architecture

### Files Involved

```
src/infrastructure/config/
├── config.interface.ts                 # Type definition for config shape
├── configuration.validation.ts         # Joi schema with validation rules
├── configuration.ts                    # Config factory using validated vars
└── config-validation.error.ts          # Error handling utility

src/app.module.ts                       # ConfigModule setup with validation
```

### Integration Flow

```
.env file
   ↓
ConfigModule.forRoot() with validation
   ↓
Joi Schema validation (configuration.validation.ts)
   ↓
Type coercion (string → number, boolean)
   ↓
Configuration factory (configuration.ts)
   ↓
Validated config object (IAppConfig type)
   ↓
Services inject via ConfigService
```

---

## The Validation Schema

### File: `configuration.validation.ts`

Defines a Joi schema that validates all environment variables required by the application.

#### Key Features

1. **Required Variables** - Must be present or app fails at startup
2. **Optional Variables** - Can be missing (e.g., seed configuration, feature flags)
3. **Type Validation** - Ensures values are correct type (number, string, boolean)
4. **Custom Messages** - Clear error messages for each validation rule
5. **Type Coercion** - Converts string env vars to proper types

#### Validation Rules

| Variable | Type | Required | Rules | Purpose |
|----------|------|----------|-------|---------|
| `APP_SERVER_PORT` | number | ✅ | Must be valid port (0-65535) | Server listening port |
| `APP_SERVER_PREFIX` | string | ✅ | Non-empty | API endpoint prefix (e.g., `/api`) |
| `APP_CORS_ORIGIN` | string | ✅ | Non-empty | CORS origin configuration |
| `APP_CACHE_REDIS_HOST` | string | ✅ | Non-empty | Redis connection URI |
| `APP_CACHE_REDIS_TTL` | number | ✅ | ≥ 0 | Cache TTL in milliseconds |
| `DB_HOST` | string | ✅ | Non-empty | Database hostname |
| `DB_PORT` | number | ✅ | Valid port | Database port |
| `DB_USERNAME` | string | ✅ | Non-empty | Database user |
| `DB_PASSWORD` | string | ✅ | Non-empty | Database password |
| `DB_NAME` | string | ✅ | Non-empty | Database name |
| `APP_JWT_SECRET` | string | ✅ | Min 10 chars | JWT signing secret |
| `APP_JWT_EXPIRES_IN` | string | ✅ | Non-empty | JWT expiration (e.g., "15m") |
| `APP_JWT_REFRESH_EXPIRES_IN` | number | ✅ | ≥ 0 | Refresh token TTL (seconds) |
| `APP_CSRF_SECRET` | string | ✅ | Min 10 chars | CSRF token secret |
| `APP_CSRF_COOKIE` | string | ✅ | Non-empty | CSRF cookie name |
| `TYPEORM_MIGRATIONS_DIR` | string | ✅ | Non-empty | Migrations directory path |
| `TYPEORM_MIGRATIONS_TABLE_NAME` | string | ✅ | Non-empty | Migrations table name |
| `FEATURE_VALIDATE_BALANCE` | boolean | ❌ | N/A | Feature flag (defaults to true) |
| `APP_SEED_ADMIN_EMAIL` | string | ❌ | Non-empty string | Initial admin email |
| `APP_SEED_ADMIN_PASSWORD` | string | ❌ | Non-empty string | Initial admin password |
| `NODE_ENV` | string | ❌ | 'development', 'production', 'test' | Environment (defaults to 'development') |

---

## The Configuration Interface

### File: `config.interface.ts`

Defines the TypeScript type for the configuration object, enabling full type safety.

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

This interface is used by ConfigService to provide type hints when accessing config values.

---

## The Configuration Factory

### File: `configuration.ts`

Transforms validated environment variables into a structured configuration object.

```typescript
export default (): IAppConfig => {
  return {
    features: {
      validateBalance: process.env.FEATURE_VALIDATE_BALANCE === 'true',
    },
    server: {
      port: parseInt(String(process.env.APP_SERVER_PORT), 10),
      prefix: String(process.env.APP_SERVER_PREFIX),
      // ... more config
    },
    // ... rest of config
  };
};
```

**Key Point**: By the time this factory runs, Joi validation has already ensured:
- All required variables are present (no `undefined`)
- Types are correct (no invalid conversions)
- Values meet validation criteria (ports are valid, strings are non-empty, etc.)

---

## Integration with NestJS

### File: `app.module.ts`

```typescript
import { configValidationSchema } from '@infrastructure/config/configuration.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
      cache: true,
      validationSchema: configValidationSchema,
      validationOptions: {
        abortEarly: true,      // Fail on first error
        allowUnknown: true,    // Allow extra env vars
        convert: true,         // String → Number, Boolean
      },
    }),
    // ... other modules
  ],
})
export class AppModule {}
```

### Validation Options Explained

| Option | Value | Effect |
|--------|-------|--------|
| `validationSchema` | Joi schema | Applies Joi validation rules |
| `abortEarly` | `true` | Stops validation at first error (fast-fail) |
| `allowUnknown` | `true` | Permits env vars not in schema |
| `convert` | `true` | Coerces string env vars to proper types |

---

## Usage in Services

### Type-Safe ConfigService Access

#### Before Validation (Unsafe)
```typescript
constructor(private configService: ConfigService) {}

// Risky - might be undefined
const port = process.env.APP_SERVER_PORT;  // string | undefined
const cache = process.env.APP_CACHE_REDIS_HOST;  // string | undefined

// Need defensive checks
if (!port) throw new Error('...');
```

#### After Validation (Safe)
```typescript
constructor(private configService: ConfigService) {}

// Guaranteed to exist and be correct type
const port = this.configService.get<number>('server.port');  // number
const cacheHost = this.configService.get<string>('cache.redis.host');  // string

// No undefined checks needed - validation guarantees these exist
console.log(port);  // 3000 (guaranteed number, never undefined)
```

### Example Service Usage

```typescript
import { ConfigService } from '@nestjs/config';
import { IAppConfig } from '@infrastructure/config/config.interface';

@Injectable()
export class DatabaseService {
  constructor(private configService: ConfigService) {}

  getConnectionConfig() {
    // Type-safe access with guaranteed values
    return {
      host: this.configService.get<string>('database.postgres.host'),
      port: this.configService.get<number>('database.postgres.port'),
      username: this.configService.get<string>('database.postgres.username'),
      password: this.configService.get<string>('database.postgres.password'),
      database: this.configService.get<string>('database.postgres.name'),
    };
  }

  // Or get entire config object with type safety
  getAppConfig() {
    return this.configService.get<IAppConfig>(''); // Full config with IAppConfig type
  }
}
```

---

## Validation at Startup

### Successful Startup

When all environment variables are valid:

```
[Nest] 29252  - 07/26/2026, 2:59:09 AM     LOG [NestFactory] Starting Nest application...
[Nest] 29252  - 07/26/2026, 2:59:10 AM     LOG [InstanceLoader] DatabaseModule dependencies initialized +1013ms
[Nest] 29252  - 07/26/2026, 2:59:10 AM     LOG [InstanceLoader] TypeOrmModule dependencies initialized +58ms
...
[Nest] 29252  - 07/26/2026, 2:59:12 AM     LOG [InstanceLoader] HealthModule dependencies initialized +112ms
```

All modules initialize successfully because validation passed.

### Validation Error

If a required env var is missing or invalid:

```
[Nest] 14900  - 07/26/2026, 2:41:33 AM   ERROR [ExceptionHandler] Error
    at forRoot (C:\Users\...\node_modules\@nestjs\config\dist\config.module.js:96:27)
    ...
```

The application **fails to start**, forcing developers to fix the environment before proceeding.

---

## Common Validation Issues & Solutions

### Issue: `APP_SEED_ADMIN_EMAIL` Fails with Email Validation

**Problem**: `.email()` validation rejected `admin@atm-integrator.local`
- Joi's strict email validator doesn't accept `.local` TLDs (not internet-valid)

**Solution**: Changed to generic `.string()` validation for seed credentials
```typescript
APP_SEED_ADMIN_EMAIL: Joi.string().optional().allow(''),  // Accept any string
```

### Issue: String Environment Variables Not Converted to Numbers

**Problem**: `APP_SERVER_PORT` is always a string from process.env

**Solution**: Set `convert: true` in validation options
```typescript
validationOptions: {
  convert: true,  // Automatically converts "3000" string to 3000 number
}
```

### Issue: Optional Variables Fail When Missing

**Problem**: Optional seed config causes validation error even when not used

**Solution**: Use `.optional().allow('')` for optional string fields
```typescript
APP_SEED_ADMIN_PASSWORD: Joi.string().optional().allow(''),
```

---

## Best Practices

### 1. Keep Validation Schema Updated

When adding new environment variables:
1. Add to `.env` file
2. Add Joi rule to `configuration.validation.ts`
3. Add to `IAppConfig` interface
4. Add to `configuration.ts` factory

### 2. Use Meaningful Error Messages

```typescript
APP_JWT_SECRET: Joi.string().min(10).required().messages({
  'string.min': 'APP_JWT_SECRET should be at least 10 characters',
  'any.required': 'APP_JWT_SECRET is required',
}),
```

### 3. Mark Optional Variables Clearly

```typescript
// Optional - feature can be disabled
FEATURE_VALIDATE_BALANCE: Joi.boolean().default(true),

// Required - will fail if missing
APP_SERVER_PORT: Joi.number().port().required(),
```

### 4. Leverage Type Safety

Always use typed `get()` calls:
```typescript
// ✅ Good - TypeScript knows the type
const port = this.configService.get<number>('server.port');

// ❌ Avoid - loses type information
const port = this.configService.get('server.port');
```

---

## Troubleshooting

### App Won't Start with Validation Error

1. Check the error message - it will specify which env var failed
2. Verify the variable is in `.env`
3. Confirm the value matches validation rules (e.g., port is 0-65535)
4. Check for type mismatches (Joi expects numbers for numeric fields)

### ConfigService Returns Undefined

This shouldn't happen if validation passed, but if it does:
1. Verify the key path matches your config structure
2. Check that the variable is in the schema
3. Ensure it's not optional when you expect a value

### TypeScript Errors on Config Access

Use the `IAppConfig` type for compile-time checking:
```typescript
const config = this.configService.get<IAppConfig>('');
console.log(config.server.port);  // TypeScript knows this is a number
```

---

## Migration Guide

If you had environment validation elsewhere before, here's how to migrate:

### Old Way (Unsafe)
```typescript
const port = parseInt(process.env.APP_SERVER_PORT || '3000', 10);
if (isNaN(port)) throw new Error('Invalid port');
```

### New Way (Safe with Joi)
```typescript
const port = this.configService.get<number>('server.port');  // Guaranteed valid
```

Benefits:
- Validation happens once at startup (not per request)
- Single source of truth for validation rules
- Type safety from TypeScript
- Consistent error handling

---

## Summary

The Joi schema validation setup provides:

✅ **Startup Validation** - Catch missing env vars before app runs  
✅ **Type Safety** - ConfigService knows exact types  
✅ **Centralized Rules** - All validation in one schema file  
✅ **Clear Errors** - Custom messages guide developers  
✅ **Production Ready** - Fails fast on misconfiguration  

This ensures that your application's configuration is always valid and properly typed from the moment it starts.
