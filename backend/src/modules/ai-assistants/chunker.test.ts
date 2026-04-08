import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkText } from './chunker.js';

test('chunkText keeps short content in a single chunk', () => {
  assert.deepEqual(chunkText('Kurzer Text'), ['Kurzer Text']);
});

test('chunkText splits long content into overlapping chunks', () => {
  const text = 'Abschnitt eins. '.repeat(120);
  const chunks = chunkText(text, 120, 20);

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length > 0));
  assert.ok(chunks[0].includes('Abschnitt eins.'));
});
