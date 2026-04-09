import test from 'node:test';
import assert from 'node:assert/strict';
import { getNavigationItems } from './module-registry';

test('non-admin users get a profile navigation item', () => {
  const items = getNavigationItems(['dashboard', 'community'], 'user');
  assert.ok(items.some((item) => item.id === 'profile' && item.path === '/profile'));
});

test('admin items are ordered without duplicate priorities around CRM/integrations/settings', () => {
  const items = getNavigationItems(['dashboard'], 'admin')
    .filter((item) => item.group === 'admin')
    .sort((a, b) => a.order - b.order);

  const orderedIds = items.map((item) => item.id);
  assert.deepEqual(orderedIds, [
    'admin-users',
    'admin-org',
    'crm',
    'admin-integrations',
    'admin-settings',
  ]);
});
