# ISC ATM Integrator Backend — Complete Project Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & Design Patterns](#architecture--design-patterns)
3. [Technology Stack](#technology-stack)
4. [Database Schema](#database-schema)
5. [Core Features & Modules](#core-features--modules)
6. [Communication Flow](#communication-flow)
7. [Code Organization](#code-organization)
8. [Authentication & Security](#authentication--security)
9. [Development Workflow](#development-workflow)
10. [Testing Strategy](#testing-strategy)
11. [Deployment & Configuration](#deployment--configuration)
12. [API Documentation](#api-documentation)

---

## Project Overview

**ISC ATM Integrator** is a backend API that acts as an **interceptor bank** (intermediary) for handling transactions between multiple banks. The system receives transfer requests from Bank 1, adapts them to the format expected by Bank 2 (or other connected banks), and manages the complete transaction lifecycle including reconciliation and notifications.

### Key Responsibilities

- **Transaction Routing**: Receive transactions from source banks and route them to target banks
- **Format Adaptation**: Transform bank-specific transaction formats into a standardized format
- **State Management**: Track transaction states through complete lifecycle (pending → completed/failed)
- **Reconciliation**: Match internal transactions with external responses to ensure consistency
- **Notifications**: Async notification of transaction results to all parties
- **API Key Authentication**: Secure communication with external banks via API keys
- **User Management**: RBAC-based access control with profiles and permissions

### High-Level Transaction Flow

```
1. Bank 1 sends transfer request + API Key to BanNet (REST)
2. BanNet validates and adapts the transfer format
3. BanNet sends adapted transfer to Bank 2 (REST)
4. Bank 2 confirms reception (sync response)
5. BanNet responds to Bank 1 with sync result
6. BanNet publishes async event (internal event bus)
7. Reconciliation service matches internal & external transactions
8. Notifications service sends final result to Bank 1 and Bank 2
```

**Diagram Reference**: See `bannet_secuencia_comunicacion.png` in the `documentacion/` folder for visual sequence diagram.

---

## Architecture & Design Patterns

### Hexagonal Architecture (Ports & Adapters)

Each feature module follows a three-layer structure:

```
Feature Module
├── domain/           (Business logic, Entities, Interfaces)
│   ├── *.ts          (Domain models)
│   └── *.repository  (Abstract repository interfaces)
├── application/      (Use cases, CQRS)
│   ├── commands/     (Write operations)
│   ├── queries/      (Read operations)
│   └── services/     (Application services)
└── infrastructure/   (Technical implementations)
    ├── persistence/  (TypeORM repositories, entities)
    └── [other adapters]
└── presentation/     (HTTP Controllers, DTOs)
```

### CQRS Pattern (Command Query Responsibility Segregation)

The application uses **NestJS CQRS** module to separate read and write operations:

- **Commands**: Mutations that modify state (CreateTransaction, Transfer, UpdateState)
  - Located in: `features/*/application/commands/*/handler.ts`
  - Handle side effects and state changes
  - Return Result<T> type for consistent error handling
  
- **Queries**: Read-only operations (GetTransactions, GetTransactionById)
  - Located in: `features/*/application/queries/*/handler.ts`
  - Use caching when appropriate (via `CacheResultService`)
  - Should not modify state

**Example Command Handler**:
```typescript
@CommandHandler(CreateTransactionCommand)
export class CreateTransactionHandler implements ICommandHandler<CreateTransactionCommand> {
    async execute(command: CreateTransactionCommand): Promise<Result<TransactionDTO>> {
        // 1. Validate
        // 2. Create domain entity
        // 3. Persist
        // 4. Emit events
        return Result.success(transactionDTO);
    }
}
```

### Dependency Injection with Repository Pattern

All data access is abstracted behind repository interfaces defined in the domain layer:

```typescript
// domain/transaction.repository.ts
export const TRANSACTION_REPOSITORY = Symbol('TRANSACTION_REPOSITORY');
export interface TransactionRepository {
    save(entity: Transaction): Promise<Transaction>;
    findById(id: UUID): Promise<Transaction | null>;
    // ...
}

// infrastructure/persistence/typeorm/transaction.repository.ts
export class TransactionRepository implements TransactionRepository {
    // TypeORM implementation
}

// Injection in module
providers: [{
    provide: TRANSACTION_REPOSITORY,
    useFactory: (dataSource: DataSource) => new TransactionRepository(dataSource),
    inject: [DataSource],
}]
```

This design allows:
- Easy mocking in tests (replace with InMemoryRepository)
- Technology independence (swap TypeORM for another ORM)
- Clear separation of concerns

### Event-Driven Architecture

NestJS EventEmitter is used for decoupled async operations:

```typescript
// Publish events
this.eventEmitter.emit('transaction.completed', new TransactionCompletedEvent(...));

// Subscribe to events
@OnEvent('transaction.completed')
async handleTransactionCompleted(event: TransactionCompletedEvent) {
    // Trigger reconciliation
    // Send notifications
}
```

Benefits:
- Decoupled modules (Transactions doesn't directly depend on Conciliation or Notifications)
- Async processing without blocking HTTP responses
- Easy to add new event handlers without modifying existing code

---

## Technology Stack

### Core Framework & Runtime

| Technology | Version | Purpose |
|------------|---------|---------|
| **NestJS** | 11.0.1 | Backend framework (TypeScript-first, enterprise-grade) |
| **Bun** | Latest | JavaScript runtime (faster than Node.js, native TypeScript) |
| **TypeScript** | 5.7.3 | Type safety and modern language features |
| **SWC** | 1.15.43 | Ultra-fast transpiler (replaces Babel/tsc) |

### Database & ORM

| Technology | Version | Purpose |
|------------|---------|---------|
| **PostgreSQL** | 12+ | Production database |
| **TypeORM** | 1.0.0 | ORM with migration support |
| **TypeORM Extension** | 3.9.0 | Seeders, transactions, advanced features |

### Caching & Performance

| Technology | Version | Purpose |
|------------|---------|---------|
| **Redis** | 6.1.0 | Distributed cache via TCP |
| **@keyv/redis** | 5.1.6 | Redis adapter for cache-manager |
| **cache-manager** | 7.2.9 | Abstraction layer for caching |

### Authentication & Security

| Technology | Version | Purpose |
|------------|---------|---------|
| **Passport.js** | 0.7.0 | Authentication middleware |
| **passport-jwt** | 4.0.1 | JWT strategy |
| **passport-local** | 1.0.0 | Email/password strategy |
| **passport-custom** | 1.1.1 | Custom API Key strategy |
| **@nestjs/jwt** | 11.0.2 | JWT token generation |
| **bcryptjs** | 3.0.3 | Password hashing |
| **csrf-csrf** | 4.0.3 | CSRF protection (double submit) |
| **Helmet** | 8.3.0 | HTTP security headers |

### Validation & Serialization

| Technology | Version | Purpose |
|------------|---------|---------|
| **class-validator** | 0.15.1 | Decorator-based validation for DTOs |
| **class-transformer** | 0.5.1 | Transform/serialize objects |

### API Documentation & Monitoring

| Technology | Version | Purpose |
|------------|---------|---------|
| **Swagger/OpenAPI** | 11.4.5 | Interactive API docs (Scalar) |
| **@scalar/nestjs-api-reference** | 1.2.9 | Alternative API doc renderer |
| **@nestjs/terminus** | 11.1.1 | Health checks (readiness/liveness) |

### Resilience & Error Handling

| Technology | Version | Purpose |
|------------|---------|---------|
| **nestjs-resilience** | 3.1.2 | Circuit breakers, retries, rate limiting |
| **nestjs-cls** | 6.2.1 | Context local storage (request-scoped metadata) |

### Development Tools

| Technology | Version | Purpose |
|------------|---------|---------|
| **Jest** | 30.0.0 | Testing framework |
| **ts-jest** | 29.2.5 | TypeScript support for Jest |
| **Husky** | 9.1.7 | Git hooks (pre-commit linting) |
| **ESLint** | 9.18.0 | Code quality & style |
| **Prettier** | 3.4.2 | Code formatting |
| **redis-memory-server** | 0.17.0 | In-memory Redis for testing |

---

## Database Schema

### ER Diagram Overview

The database consists of **13 tables** organized into these domains:

#### 1. **Authentication & Authorization**

```sql
-- Users
auth_user (id, email, password_hash, name, state, agreement_id, created_at, updated_at, deleted_at)

-- Roles/Profiles
auth_profile (id, name, description, created_at, updated_at)
user_profile (user_id, profile_id) -- Junction table

-- Permissions
auth_permission (id, resource, action, name, created_at)
profile_permission (profile_id, permission_id) -- Junction table

-- API Keys (for service-to-service auth)
api_key (id, key_hash, prefix, name, state, agreement_id, created_by, profile_id, expires_at, created_at, updated_at, deleted_at)

-- Refresh Tokens
auth_refresh_token (id, token_hash, expires_at, user_id, created_at)
```

**Key Design Points**:
- Password stored as hash (bcrypt)
- Soft deletes via `deleted_at` timestamp
- API Key strategy uses hashed values in DB, plain prefix for quick lookup
- Refresh tokens auto-expire (TTL in security config)

#### 2. **Agreements (Multi-tenancy)**

```sql
agreement (id, name, reference, state, created_at, updated_at, deleted_at)
```

Represents a contract/partnership between BanNet and external banks. Used for:
- Multi-tenancy isolation
- Quota management
- API key grouping

#### 3. **Bank Accounts**

```sql
bank_account (id, reference, type, balance, state, agreement_id, created_at, updated_at, deleted_at)
```

Internal accounts within agreements. Each account:
- Tracks balance (integer, likely in cents)
- Has a reference (e.g., "ACC-001")
- Can be active/inactive

#### 4. **Transactions**

```sql
transaction (
    id, amount, operation, type, state, description,
    bank_account_id, correlation_id, created_at, updated_at, deleted_at,
    source_bank
)
```

Core transaction record:
- `operation`: type of operation (transfer, deposit, withdrawal)
- `state`: pending, completed, failed, cancelled
- `correlation_id`: links related transactions (e.g., debit in Bank A, credit in Bank B)
- `source_bank`: tracks origin (bank_a, bank_b, etc.)
- Amount stored as integer (cents)

#### 5. **Conciliation**

```sql
conciliations (id, run_at, status, summary, created_at)
conciliation_matches (
    id, conciliation_id, internal_tx_id, external_tx_id,
    status, amount_diff, notes
)
```

Reconciliation process records:
- `conciliations`: Batch run (e.g., daily reconciliation)
- `conciliation_matches`: Individual transaction matches
- `amount_diff`: Discrepancy if any
- Status: matched, unmatched, amount_variance

#### 6. **Orders** (Business Context)

```sql
orders (id, customer_name, amount, status, created_at)
```

Generic order/request entity. Purpose TBD in full context.

#### 7. **Migrations**

```sql
typeorm_migrations (id, timestamp, name)
```

TypeORM migration tracking table (auto-managed).

### Relationships (Foreign Keys)

```
auth_user ──────→ agreement
api_key ──────→ agreement, auth_user, auth_profile
bank_account ──────→ agreement
transaction ──────→ bank_account
conciliation_matches ──────→ conciliations (cascade delete)
profile_permission ──────→ auth_profile, auth_permission
user_profile ──────→ auth_user, auth_profile
```

### Soft Delete Strategy

Tables with `deleted_at` (users, accounts, transactions, etc.) use **soft deletes**:
- Records not physically removed from DB
- Queries must filter `WHERE deleted_at IS NULL`
- Audit trail preserved (can see what was deleted and when)

---

## Core Features & Modules

### 1. **Auth Module** (`features/auth/`)

Handles authentication, authorization, and API key management.

**Sub-features**:
- **Local Login**: Email + password authentication
- **JWT**: Short-lived tokens (default 15m) + refresh tokens (7d)
- **API Key Auth**: Service-to-service authentication with expiration
- **CSRF Protection**: Double-submit cookie pattern
- **Permissions**: Fine-grained RBAC (resource + action)

**Key Components**:
```
auth/
├── domain/
│   ├── auth-user.ts          # User entity
│   ├── api-key.ts            # API Key entity
│   ├── auth-permission.ts    # Permission entity
│   └── *.repository.ts       # Abstract interfaces
├── application/
│   ├── commands/
│   │   ├── login/
│   │   ├── refresh/
│   │   ├── generate-api-key/
│   │   └── revoke-api-key/
│   ├── queries/
│   │   └── get-api-keys/
│   └── csrf.service.ts
├── infrastructure/
│   ├── persistence/          # TypeORM implementations
│   └── csrf.middleware.ts
├── passport/
│   ├── local.strategy.ts     # Email/password
│   ├── jwt.strategy.ts       # JWT token
│   ├── api-key.strategy.ts   # API Key
│   └── guards/
│       ├── jwt-auth.guard.ts
│       ├── api-key-auth.guard.ts
│       └── combined-auth.guard.ts
└── presentation/
    ├── auth.controller.ts    # Login, refresh endpoints
    ├── csrf-token.controller.ts
    └── permissions.guard.ts
```

**Authentication Strategies**:

| Strategy | Use Case | Token Lifetime | Refresh |
|----------|----------|----------------|---------|
| JWT (Local) | Interactive users | 15 minutes | Refresh token (7 days) |
| API Key | Service-to-service | No expiry (unless configured) | Not applicable |
| Combined | Fallback to API Key if JWT fails | Flexible | Both supported |

### 2. **Transactions Module** (`features/transactions/`)

Core business logic for creating, updating, and querying transactions.

**Commands**:
- `CreateTransactionCommand`: Record a new transaction
- `TransferCommand`: Transfer amount between accounts
- `UpdateTransactionStateCommand`: Update transaction state

**Queries**:
- `GetTransactionsQuery`: List transactions (paginated, cached)
- `GetTransactionByIdQuery`: Get single transaction

**Features**:
- Balance validation (if feature flag enabled)
- State machine (pending → completed/failed)
- Correlation ID tracking for related transactions
- Caching of frequently accessed transactions

### 3. **Accounts Module** (`features/accounts/`)

Manages bank accounts and balances.

**Entities**:
- `BankAccount`: Reference, type, balance, state

**Operations**:
- Create account
- Update balance
- Query accounts
- State management (active/inactive)

### 4. **Agreements Module** (`features/agreements/`)

Multi-tenancy support via agreements (contracts with external banks).

**Entities**:
- `Agreement`: Name, reference, state

**Purpose**:
- Isolate data per external bank/partner
- Group users and API keys
- Track partnerships

### 5. **Conciliation Module** (`features/conciliation/`)

Reconciliation process to match internal transactions with external responses.

**Commands**:
- `RunConciliationCommand`: Execute full reconciliation batch

**Queries**:
- `GetConciliationResultsQuery`: Fetch conciliation report

**Logic**:
- Match internal transactions with external responses
- Detect amount discrepancies
- Generate reconciliation report (summary JSONB)
- Publish events for follow-up actions

**State Tracking**:
- `status`: pending, completed, failed, manual_review
- `matches`: matched, unmatched, amount_variance

### 6. **Notifications Module** (`features/notifications/`)

Async notification delivery (events → notifications to external parties).

**Triggers**:
- Transaction completed/failed
- Reconciliation finished
- API key about to expire

**Channels** (TBD):
- REST webhooks
- Email
- SMS
- Internal event log

### 7. **Orders Module** (`features/orders/`)

Business context for orders/payment requests.

**Current Status**: Basic structure present, business logic TBD.

### 8. **Health Module** (`infrastructure/health/`)

Kubernetes-style health checks.

**Endpoints**:
- `/health` - Liveness probe (app running?)
- `/health/ready` - Readiness probe (dependencies available?)

**Checks**:
- Database connectivity
- Redis connectivity
- Migrations status

---

## Communication Flow

### Synchronous Flow (REST API)

```
External Bank (Banco 1)
    ↓
[REST] POST /api/v1/transactions/transfer + API Key
    ↓
Auth Guard → Validate API Key → Extract agreement_id
    ↓
Transactions Controller
    ↓
TransferHandler (CQRS)
    ├─ Validate balance (if enabled)
    ├─ Create domain Transaction entity
    ├─ Persist to DB
    └─ Emit TransactionCreatedEvent
    ↓
[REST] 200 OK { transactionId, status, ... }
    ↓
External Bank (Banco 1) gets immediate response
```

### Asynchronous Flow (Internal Event Bus)

```
TransactionCreatedEvent published
    ↓
[Multiple subscribers listen]
    ├─ ConciliationService: Add to pending reconciliation queue
    ├─ NotificationService: Queue notification job
    └─ [Other handlers]
    ↓
Later: Reconciliation runs (scheduled or manual)
    ├─ Match with external Bank 2 response
    ├─ Generate summary
    └─ Emit ReconciliationCompleted event
    ↓
Notifications service sends final result
    ↓
External Banks notified (REST callback or webhook)
```

### Bank Adapter Pattern

The system is designed to support multiple banks. For each external bank, implement:

1. **Outbound Adapter**: Transform BanNet transaction → Bank-specific format
   - Location: `infrastructure/adapters/banks/`
   - Example: `BankATransactionAdapter`, `BankBTransactionAdapter`

2. **Inbound Adapter**: Parse Bank response → BanNet format
   - Deserialize bank response
   - Update transaction state
   - Handle errors

3. **Configuration**: Bank endpoints in environment variables
   ```env
   BANK_A_API_URL=https://bank-a-api.example.com
   BANK_B_API_URL=https://bank-b-api.example.com
   ```

---

## Code Organization

### Directory Structure

```
src/
├── app.module.ts              # Root module
├── main.ts                    # Bootstrap
├── metadata.ts                # App metadata
│
├── features/                  # Feature modules (CQRS per feature)
│   ├── accounts/
│   │   ├── accounts.module.ts
│   │   ├── domain/            # Business entities & interfaces
│   │   ├── application/       # CQRS commands & queries
│   │   ├── infrastructure/    # TypeORM, adapters
│   │   └── presentation/      # Controllers, DTOs, Guards
│   │
│   ├── agreements/
│   ├── auth/                  # Complex authentication module
│   ├── conciliation/
│   ├── notifications/
│   ├── orders/
│   └── transactions/          # Core transaction logic
│
├── infrastructure/            # Cross-cutting concerns
│   ├── cache/                 # Redis integration
│   ├── config/                # Configuration & setup
│   │   ├── configuration.ts   # Typed config object
│   │   ├── cors.ts
│   │   ├── helmet.ts          # Security headers
│   │   ├── swagger.ts         # API docs setup
│   │   ├── validations.ts     # Global validation pipe
│   │   ├── versioning.ts      # API versioning
│   │   └── async-local-storage.ts  # Request context
│   ├── database/              # TypeORM & migrations
│   │   ├── data-source.ts
│   │   ├── database.module.ts
│   │   ├── factories/         # Test data factories
│   │   ├── migrations/        # TypeORM migrations
│   │   └── seeds/             # Database seeders
│   └── health/                # Health checks
│
├── shared/                    # Shared utilities
│   └── core/
│       ├── result.ts          # Result<T> type for errors
│       ├── types.ts           # Common types
│       ├── cache/             # Caching utilities
│       ├── exceptions/        # Custom exceptions
│       ├── response/          # Response formatting
│       └── __tests__/         # Shared test utilities
│
└── test/                      # E2E tests (outside src/)
    ├── app.e2e-spec.ts
    ├── conciliation.e2e-spec.ts
    ├── jest-e2e.json
    └── swagger-format.spec.ts
```

### Module Imports Pattern

**App Module** imports all feature modules:

```typescript
@Module({
    imports: [
        EventEmitterModule.forRoot({ global: true }),
        ResilienceModule.forRoot({}),
        DatabaseModule.forRoot(),
        ClsModule.forRoot({ global: true }),
        ConfigModule.forRoot({ load: [configuration], isGlobal: true }),
        CacheModule,
        // Features
        AuthModule,
        OrdersModule,
        AgreementsModule,
        BankAccountsModule,
        TransactionsModule,
        NotificationsModule,
        ConciliationModule,
        HealthModule,
    ],
    providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
```

**Feature Modules** follow this pattern:

```typescript
@Module({
    imports: [
        TypeOrmModule.forFeature([Entity1, Entity2]),
        CqrsModule,  // For CQRS handlers
        OtherModule, // Shared modules
    ],
    controllers: [FeatureController],
    providers: [
        { provide: REPOSITORY_TOKEN, useFactory: ... },
        CommandHandler1,
        CommandHandler2,
        QueryHandler1,
        QueryHandler2,
        CacheResultService,
    ],
    exports: [REPOSITORY_TOKEN], // Expose to other modules
})
export class FeatureModule {}
```

### Naming Conventions

| Entity | Pattern | Example |
|--------|---------|---------|
| Domain Entities | PascalCase | `Transaction`, `ConciliationMatch` |
| TypeORM Entities | PascalCase + `Entity` suffix | `TransactionEntity`, `BankAccountEntity` |
| Repositories (interface) | PascalCase + `Repository` | `TransactionRepository` |
| Commands | PascalCase + `Command` | `CreateTransactionCommand` |
| Queries | PascalCase + `Query` | `GetTransactionsQuery` |
| Events | PascalCase + `Event` | `TransactionCreatedEvent` |
| DTOs | PascalCase + `Dto` | `CreateTransactionDto`, `TransactionResponseDto` |
| Controllers | PascalCase + `Controller` | `TransactionsController` |
| Services | PascalCase + `Service` | `CacheResultService`, `CsrfService` |

---

## Authentication & Security

### Authentication Flow

#### 1. JWT (Interactive Users)

```
POST /api/v1/auth/login
  ├─ Input: { email, password }
  └─ Output: { accessToken, refreshToken }

Uses: Local Strategy (Passport)
  ├─ Hash password with bcrypt
  ├─ Generate JWT (15m expiry)
  ├─ Generate Refresh Token (7d expiry, stored in DB)
  └─ Return tokens to client

Subsequent requests:
  ├─ Header: Authorization: Bearer <jwt>
  ├─ JWT Strategy validates & extracts claims
  └─ Request proceeds with user context
```

#### 2. API Key (Service-to-Service)

```
POST /api/v1/transactions/transfer
  ├─ Header: X-Api-Key: <key>
  └─ Or Query: ?apiKey=<key>

Uses: Custom API Key Strategy (Passport)
  ├─ Extract API key from header/query
  ├─ Hash it (bcrypt)
  ├─ Lookup in DB by hash
  ├─ Check expiration (if set)
  ├─ Extract agreement_id from key
  └─ Proceed with service context (no user, but has agreement)
```

#### 3. CSRF Protection

**Enabled by default** (configurable via `APP_CSRF_ENABLED`).

Pattern: **Double-Submit Cookie**

```
GET /api/v1/csrf-token
  └─ Response: { token: "random-string", cookie: "x-csrf-token=..." }

POST /api/v1/...
  ├─ Cookie: x-csrf-token=<token>
  ├─ Header: X-Csrf-Token: <token>
  └─ Both must match, verified in middleware
```

### Authorization: RBAC (Role-Based Access Control)

**Hierarchy**:
```
Permission (resource + action)
    ↑
    └─ auth_permission (e.g., "read:transactions", "write:api_keys")

Profile (collection of permissions)
    ↑
    └─ auth_profile (e.g., "Admin", "ReadOnly")

User (assigned profiles)
    ↑
    └─ user_profile (many-to-many)
```

**Example Usage**:

```typescript
// In controller
@UseGuards(JwtAuthGuard, PermissionsGuard)
@CheckPermission('read', 'transactions')
@Get('/')
getTransactions() { ... }

// PermissionsGuard checks:
// 1. Extract user from request
// 2. Load user's profiles
// 3. Load permissions for those profiles
// 4. Check if 'read:transactions' is present
// 5. Proceed or throw ForbiddenException
```

### Security Headers (Helmet)

Automatically adds security headers:
- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security`
- etc.

### Password Hashing

- **Algorithm**: bcryptjs (v3.0.3)
- **Rounds**: Default 10 (bcrypt default)
- Used for: User passwords, API key hashes, Refresh token hashes

### Configuration

```typescript
// From src/infrastructure/config/configuration.ts
security: {
    jwt: {
        secret: process.env.APP_JWT_SECRET,
        expiresIn: '15m',
        refreshExpiresIn: 604800,  // 7 days in seconds
    },
    csrf: {
        enabled: process.env.APP_CSRF_ENABLED !== 'false',
        secret: process.env.APP_CSRF_SECRET,
        cookieName: 'x-csrf-token',
    },
}
```

---

## Development Workflow

### Setup & Installation

```bash
# Prerequisites
node >= 18 (or use bun which is faster)
bun >= 1.x
PostgreSQL >= 12
Redis >= 6

# Install dependencies
bun install

# Setup environment
cp .env.example .env
# Edit .env with your local database credentials

# Database setup
bun run migration:run    # Run all migrations
bun run seed             # Populate test data
```

### Available Commands

```bash
# Development
bun run start:dev        # Watch mode with HMR (SWC transpiler)
bun run start:debug      # Debug mode with Node inspector

# Production
bun run build            # Compile TypeScript → JavaScript (SWC)
bun run start:prod       # Run compiled app

# Database
bun run migration:run    # Apply pending migrations
bun run migration:revert # Rollback last migration
bun run seed             # Run seeders
bun run seed:create      # Generate new seeder template

# Testing
bun test                 # Run all tests (unit + e2e)
bun run test:watch      # Watch mode for tests
bun run test:cov        # Generate coverage report

# Code Quality
bun run lint            # Lint & auto-fix
bun run format          # Format with Prettier
```

### Environment Variables

See [Deployment & Configuration](#deployment--configuration) section.

### Git Workflow

**Pre-commit Hook** (via Husky):
```bash
# Automatically runs on git commit
- ESLint on staged files
- Type checking (TypeScript)
```

**Conventional Commits** (recommended):
```
feat: add transaction reconciliation
fix: correct balance calculation
docs: update API documentation
test: add transaction handler tests
```

### Database Migrations

**Creating a Migration**:

```bash
bun run build  # Compile first
bun --bun typeorm migration:generate -d dist/infrastructure/database/data-source.js src/infrastructure/database/migrations/MigrationName

# Edit the generated migration if needed
bun run migration:run  # Apply
```

**Common Migration Scenarios**:

| Scenario | Command |
|----------|---------|
| Add column | `ALTER TABLE ... ADD COLUMN ...` |
| Create table | Use TypeORM entity sync or manual SQL |
| Create index | `CREATE INDEX ... ON ...` |
| Add FK | `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY ...` |
| Drop table | Use `DROP TABLE ... CASCADE` with caution |

### TypeScript Compilation

- **Transpiler**: SWC (ultra-fast)
- **Output**: `dist/` directory
- **Source Maps**: Enabled for debugging
- **Strict Mode**: Enabled (no implicit `any`)

### IDE Setup (VS Code)

**Recommended Extensions**:
- ESLint
- Prettier
- TypeScript Vue Plugin (if using Vue)
- REST Client (for API testing)
- Thunder Client / Postman

**Settings** (`settings.json`):
```json
{
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
        "source.fixAll.eslint": true
    }
}
```

---

## Testing Strategy

### Current State

| Test Type | Count | Coverage |
|-----------|-------|----------|
| Unit Tests | 0 | 0% |
| Integration Tests | 0 | 0% |
| E2E Tests | 1 | Outdated |
| **Total** | **1** | **~0%** |

### Proposed Testing Pyramid

```
        ╱╲
       ╱  ╲        E2E (5%)
      ╱    ╲       Full flow tests with supertest
     ╱──────╲
    ╱        ╲     Integration (25%)
   ╱          ╲    Handlers + InMemoryRepositories
  ╱────────────╲
 ╱              ╲  Unit (70%)
╱                ╲ Domain models, utilities, DTOs
```

### Unit Tests (70% Priority)

**Targets**: Domain models, DTOs, shared utilities, pure functions

**Example: Domain Entity**:
```typescript
// features/conciliation/domain/__tests__/conciliation.spec.ts
describe('Conciliation (Domain)', () => {
    it('should create with status "pending" by default', () => {
        const conciliation = new Conciliation({ summary: {} });
        expect(conciliation.status).toBe('pending');
    });

    it('should calculate summary correctly', () => {
        const conciliation = new Conciliation({
            summary: { matched: 5, unmatched: 2 }
        });
        expect(conciliation.summary.matched).toBe(5);
    });
});
```

**Example: DTO Validation**:
```typescript
// features/transactions/presentation/__tests__/create-transaction.dto.spec.ts
describe('CreateTransactionDto', () => {
    it('should validate valid DTO', async () => {
        const dto = new CreateTransactionDto();
        dto.amount = 1000;
        dto.description = 'Test transfer';
        
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should reject negative amount', async () => {
        const dto = new CreateTransactionDto();
        dto.amount = -100;
        
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
    });
});
```

### Integration Tests (25% Priority)

**Targets**: Command/Query handlers with mocked repositories

**Pattern**: Use `InMemoryRepository` implementations

```typescript
// features/transactions/application/commands/__tests__/create-transaction.spec.ts
describe('CreateTransactionHandler', () => {
    let handler: CreateTransactionHandler;
    let transactionRepo: InMemoryTransactionRepository;

    beforeEach(() => {
        transactionRepo = new InMemoryTransactionRepository();
        handler = new CreateTransactionHandler(transactionRepo);
    });

    it('should create transaction and persist', async () => {
        const command = new CreateTransactionCommand({ ... });
        const result = await handler.execute(command);

        expect(result.isSuccess()).toBe(true);
        expect(transactionRepo.saved.length).toBe(1);
    });
});
```

**InMemory Repository Pattern**:
```typescript
export class InMemoryTransactionRepository implements TransactionRepository {
    private items = new Map<string, Transaction>();

    async save(entity: Transaction): Promise<Transaction> {
        this.items.set(entity.id, entity);
        return entity;
    }

    async findById(id: string): Promise<Transaction | null> {
        return this.items.get(id) ?? null;
    }
}
```

Benefits:
- Fast (no DB I/O)
- Isolated (no side effects)
- Deterministic
- Easy to setup/teardown

### E2E Tests (5% Priority)

**Targets**: Complete workflows via HTTP API

**Tools**: supertest + Testcontainers (if using Docker)

```typescript
// test/transactions.e2e-spec.ts
describe('Transactions E2E', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleFixture = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    it('POST /transactions should create transaction', async () => {
        return request(app.getHttpServer())
            .post('/api/v1/transactions')
            .set('Authorization', `Bearer ${token}`)
            .send({
                amount: 1000,
                description: 'Test transfer',
            })
            .expect(201)
            .expect((res) => {
                expect(res.body.id).toBeDefined();
                expect(res.body.status).toBe('pending');
            });
    });
});
```

### Running Tests

```bash
# All tests
bun test

# Specific file
bun test src/features/transactions/domain/__tests__/transaction.spec.ts

# Watch mode
bun run test:watch

# Coverage report
bun run test:cov
```

### Test Data Factories

Use Faker.js for realistic test data:

```typescript
// infrastructure/database/factories/transaction.factory.ts
export class TransactionFactory {
    static create(overrides?: Partial<Transaction>): Transaction {
        return new Transaction({
            id: faker.string.uuid(),
            amount: faker.number.int({ min: 100, max: 100000 }),
            operation: 'transfer',
            description: faker.lorem.sentence(),
            ...overrides,
        });
    }
}

// Usage in tests
const transaction = TransactionFactory.create({ amount: 5000 });
```

---

## Deployment & Configuration

### Environment Variables

Create `.env` file in project root:

```bash
# === Server ===
NODE_ENV=development
APP_SERVER_PORT=7000
APP_SERVER_PREFIX=/api

# === Database (PostgreSQL) ===
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=isc_atm

# === Cache (Redis) ===
APP_CACHE_REDIS_HOST=redis://localhost:6379
APP_CACHE_REDIS_TTL=60000  # 1 minute in milliseconds

# === Security ===
APP_JWT_SECRET=your-jwt-secret-here-change-in-prod
APP_JWT_EXPIRES_IN=15m
APP_JWT_REFRESH_EXPIRES_IN=604800  # 7 days in seconds

# === CSRF ===
APP_CSRF_ENABLED=true
APP_CSRF_SECRET=your-csrf-secret-change-in-prod
APP_CSRF_COOKIE=x-csrf-token

# === CORS ===
APP_CORS_ORIGIN=*
APP_CORS_METHODS=GET,HEAD,PUT,PATCH,POST,DELETE
APP_CORS_CREDENTIALS=false

# === Features ===
FEATURE_VALIDATE_BALANCE=true

# === Database Migrations (Optional) ===
TYPEORM_MIGRATIONS_DIR=src/infrastructure/database/migrations
TYPEORM_MIGRATIONS_TABLE_NAME=typeorm_migrations
```

### Configuration Structure

All configuration is centralized in [src/infrastructure/config/configuration.ts](src/infrastructure/config/configuration.ts):

```typescript
export default () => ({
    features: { ... },
    app: { ... },
    server: { ... },
    cache: { ... },
    database: { ... },
    security: { ... },
})
```

**Typed Access**:
```typescript
constructor(private configService: AppConfigService) {}

const port = this.configService.get('server.port', { infer: true });
const jwtSecret = this.configService.get('security.jwt.secret', { infer: true });
```

### Docker Deployment

**Dockerfile** (example):

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install
COPY . .
RUN bun run build

# Runtime stage
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --only=production
COPY --from=builder /app/dist ./dist
EXPOSE 7000
CMD ["node", "dist/main.js"]
```

**Docker Compose** (example):

```yaml
version: '3.8'
services:
  backend:
    build: .
    ports:
      - "7000:7000"
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      APP_CACHE_REDIS_HOST: redis://redis:6379
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: isc_atm
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

### Health Checks

API provides health check endpoints for Kubernetes:

```bash
# Liveness probe (is app running?)
curl http://localhost:7000/health

# Readiness probe (are dependencies available?)
curl http://localhost:7000/health/ready
```

**Kubernetes Example**:
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 7000
  initialDelaySeconds: 10
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/ready
    port: 7000
  initialDelaySeconds: 5
  periodSeconds: 5
```

### Performance Considerations

1. **Caching**: Redis caches frequently accessed queries (transactions, agreements)
2. **Database Indexing**: Primary keys + foreign keys indexed by default
3. **Connection Pooling**: TypeORM manages connection pool
4. **SWC Transpiler**: Ultra-fast compilation (5x faster than tsc)
5. **Bun Runtime**: Faster startup than Node.js

### Monitoring & Logging

**Structured Logging** (TBD):
- Consider Winston or Pino for production
- Log levels: error, warn, info, debug
- Structured format for log aggregation (ELK, Datadog, etc.)

**Application Metrics** (TBD):
- Consider Prometheus client for metrics
- Track: request count, response time, error rate
- Export to monitoring system (Prometheus, Grafana)

---

## API Documentation

### Interactive Documentation

Once the app is running:

```
http://localhost:7000/api/reference
```

**Technology**: Scalar.com (alternative to Swagger UI)

### Main Endpoints

#### Authentication

```
POST   /api/v1/auth/login              # Email + password login
POST   /api/v1/auth/refresh            # Refresh JWT
POST   /api/v1/auth/logout             # Logout (invalidate refresh token)
GET    /api/v1/csrf-token              # Get CSRF token + cookie
```

#### Transactions

```
GET    /api/v1/transactions            # List transactions (paginated)
GET    /api/v1/transactions/:id        # Get transaction by ID
POST   /api/v1/transactions            # Create transaction
POST   /api/v1/transactions/transfer   # Transfer (between accounts/banks)
PATCH  /api/v1/transactions/:id        # Update transaction state
```

#### Bank Accounts

```
GET    /api/v1/accounts                # List accounts
GET    /api/v1/accounts/:id            # Get account
POST   /api/v1/accounts                # Create account
```

#### Agreements

```
GET    /api/v1/agreements              # List agreements
GET    /api/v1/agreements/:id          # Get agreement
```

#### API Keys

```
GET    /api/v1/auth/api-keys           # List API keys
POST   /api/v1/auth/api-keys           # Generate new API key
DELETE /api/v1/auth/api-keys/:id       # Revoke API key
```

#### Health

```
GET    /health                         # Liveness probe
GET    /health/ready                   # Readiness probe
```

### Request/Response Examples

**Create Transaction**:
```bash
curl -X POST http://localhost:7000/api/v1/transactions \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "description": "Transfer to external account",
    "bankAccountId": "12345678-1234-1234-1234-123456789012"
  }'
```

Response:
```json
{
  "id": "87654321-4321-4321-4321-210987654321",
  "amount": 5000,
  "operation": "transfer",
  "state": "pending",
  "description": "Transfer to external account",
  "createdAt": "2025-07-22T10:30:00Z"
}
```

**List Transactions** (with pagination):
```bash
curl "http://localhost:7000/api/v1/transactions?page=1&limit=10" \
  -H "Authorization: Bearer <jwt>"
```

Response:
```json
{
  "data": [
    { "id": "...", "amount": 5000, "state": "completed", ... },
    { "id": "...", "amount": 2000, "state": "pending", ... }
  ],
  "total": 50,
  "page": 1,
  "limit": 10
}
```

---

## Key Design Decisions

### Why CQRS?

- **Separation of Concerns**: Reads and writes have different optimization strategies
- **Scalability**: Can scale read model independently with caching
- **Testability**: Command/Query handlers are easy to test in isolation
- **Event Sourcing Ready**: Foundation for event sourcing if needed later

### Why Repository Pattern?

- **Technology Independence**: Easy to swap TypeORM for another ORM
- **Testability**: Mock repositories in tests without affecting business logic
- **Multi-tenancy**: Same code works with different data stores per tenant

### Why Events?

- **Decoupling**: Modules don't need to know about each other
- **Async Processing**: Notifications, reconciliation don't block main request
- **Future Extensibility**: Add new event subscribers without modifying existing code

### Why Soft Deletes?

- **Audit Trail**: Can see what was deleted and when
- **Compliance**: Some regulations require keeping historical data
- **Recovery**: Can restore deleted records if needed
- **Performance**: No data loss, just logical deletion

### Why Typed Config?

- **Type Safety**: Compile-time checks for config keys
- **Autocomplete**: IDE can suggest available config properties
- **Runtime Validation**: Config service ensures required values are present

---

## Next Steps & TODOs

### Short Term
- [ ] Implement unit tests (70% target) for domain models and handlers
- [ ] Add integration tests with InMemoryRepositories
- [ ] Implement structured logging (Winston/Pino)
- [ ] Add monitoring/metrics (Prometheus)
- [ ] Document bank adapter implementation guide

### Medium Term
- [ ] Implement actual bank adapters (Bank A, Bank B)
- [ ] Webhook notification delivery
- [ ] Email/SMS notification channels
- [ ] Advanced reconciliation logic (amount variance handling)
- [ ] Pagination & filtering standardization across all queries

### Long Term
- [ ] Event sourcing (if audit requirements evolve)
- [ ] SAGA pattern for distributed transactions
- [ ] API rate limiting per agreement
- [ ] Advanced analytics & reporting
- [ ] Multi-region deployment

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `Cannot find module` | Missing imports | Run `bun install` |
| `Database connection refused` | PostgreSQL not running | Start PostgreSQL service, check credentials |
| `Redis connection refused` | Redis not running | Start Redis or use in-memory fallback |
| `Port 7000 already in use` | Another app using port | Change `APP_SERVER_PORT` in `.env` |
| `Migrations fail` | DB schema mismatch | Rollback and re-apply: `bun run migration:revert` then `bun run migration:run` |
| `Type errors in tests` | TypeScript config issue | Ensure `tsconfig.json` includes `test/` folder |

### Debug Mode

```bash
# Start with Node debugger
bun run start:debug

# VS Code launch config (.vscode/launch.json)
{
  "type": "node",
  "request": "attach",
  "name": "Attach to NestJS",
  "port": 9229,
  "restart": true,
  "protocol": "inspector"
}
```

---

## Resources & References

- **NestJS**: https://docs.nestjs.com
- **TypeORM**: https://typeorm.io
- **Passport.js**: https://www.passportjs.org
- **CQRS Pattern**: https://martinfowler.com/bliki/CQRS.html
- **Hexagonal Architecture**: https://en.wikipedia.org/wiki/Hexagonal_architecture_(software)
- **Bun**: https://bun.sh

---

## Document Metadata

- **Version**: 1.0
- **Last Updated**: 2025-07-22
- **Status**: Complete
- **Maintained By**: Development Team
