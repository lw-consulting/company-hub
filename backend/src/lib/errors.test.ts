import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from './errors.js';

test('UnauthorizedError uses HTTP 401', () => {
  const error = new UnauthorizedError();
  assert.equal(error.statusCode, 401);
  assert.equal(error.code, 'INVALID_CREDENTIALS');
});

test('ValidationError keeps field details', () => {
  const error = new ValidationError({ email: ['Ungueltig'] });
  assert.equal(error.statusCode, 400);
  assert.deepEqual(error.details, { email: ['Ungueltig'] });
});

test('NotFoundError extends AppError', () => {
  const error = new NotFoundError('Fehlt');
  assert.ok(error instanceof AppError);
  assert.equal(error.statusCode, 404);
  assert.equal(error.message, 'Fehlt');
});

test('ForbiddenError uses HTTP 403', () => {
  const error = new ForbiddenError();
  assert.equal(error.statusCode, 403);
  assert.equal(error.code, 'FORBIDDEN');
});
