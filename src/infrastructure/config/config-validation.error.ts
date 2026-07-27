/**
 * Custom validation error handler for environment variables
 * Provides clear, actionable error messages when env var validation fails
 */
export class ConfigValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ConfigValidationError';
    }
}

interface ValidationError {
    error?: {
        message?: string;
        details?: Array<{ message: string }>;
    };
    message?: string;
}

/**
 * Wraps Joi validation to provide better error messages
 * @param validationError - Joi validation error object
 * @throws ConfigValidationError with formatted error message
 */
export function throwConfigValidationError(
    validationError: ValidationError,
): void {
    if (validationError.error) {
        const message =
            validationError.error.message || 'Unknown validation error';
        const details =
            validationError.error.details
                ?.map((detail) => `  • ${detail.message}`)
                .join('\n') || message;

        throw new ConfigValidationError(
            `Environment validation failed:\n${details}\n\nPlease check your .env file and ensure all required variables are set correctly.`,
        );
    }

    throw new ConfigValidationError(
        `Environment validation failed: ${validationError.message || 'Unknown error'}`,
    );
}
