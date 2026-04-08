import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveImageUrl } from './api';

test('resolveImageUrl keeps absolute URLs unchanged', () => {
  assert.equal(resolveImageUrl('https://example.com/image.png'), 'https://example.com/image.png');
});

test('resolveImageUrl prepends backend root for upload paths', () => {
  assert.equal(resolveImageUrl('/uploads/avatar.png'), '/uploads/avatar.png');
});

test('resolveImageUrl returns empty string for missing values', () => {
  assert.equal(resolveImageUrl(undefined), '');
});
