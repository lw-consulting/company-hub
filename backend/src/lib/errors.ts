import type { ErrorCode } from '@company-hub/shared';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Nicht autorisiert', code: ErrorCode = 'INVALID_CREDENTIALS') {
    super(401, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Zugriff verweigert', code: ErrorCode = 'FORBIDDEN') {
    super(403, code, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Nicht gefunden') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Konflikt') {
    super(409, 'CONFLICT', message);
  }
}

export class ValidationError extends AppError {
  constructor(details: Record<string, string[]>) {
    super(400, 'VALIDATION_ERROR', 'Validierungsfehler', details);
  }
}
