import test from 'node:test';
import assert from 'node:assert/strict';

let SessionScope;
try { ({ SessionScope } = await import('../extension/session-policy.mjs')); } catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}
const make = (options = {}) => {
  assert.equal(typeof SessionScope, 'function', 'SessionScope must enforce the session boundary');
  return new SessionScope({ tabId: 7, origin: 'https://careers.example', startedAt: 1000, ...options });
};
const inspect = (scope, overrides = {}) => scope.inspect({ tabId: 7, activeTabId: 7, url: 'https://careers.example/application/contact', contextKey: '', now: 1001, ...overrides });

test('same-origin steps are allowed but unidentified context stays unconfirmed', () => {
  const scope = make();
  assert.deepEqual(inspect(scope), { allowed: true, reason: 'context-unconfirmed', lock: false, pause: false });
  assert.equal(inspect(scope, { url: 'https://careers.example/application/work?step=3' }).allowed, true);
  assert.equal(scope.bindContext('sha256:application-one'), true);
  assert.deepEqual(inspect(scope, { contextKey: 'sha256:application-one' }), { allowed: true, reason: 'ok', lock: false, pause: false });
  assert.equal(inspect(scope).reason, 'context-unconfirmed');
});

test('tab source active tab origin and known application changes pause writes', () => {
  const scope = make(); scope.bindContext('one');
  for (const [overrides, reason] of [
    [{ tabId: 8 }, 'wrong-tab'], [{ activeTabId: 8 }, 'inactive-tab'],
    [{ tabId: undefined }, 'wrong-tab'], [{ activeTabId: undefined }, 'inactive-tab'],
    [{ url: 'https://other.example/apply' }, 'origin-changed'],
    [{ url: 'http://careers.example/apply' }, 'invalid-url'],
    [{ url: 'https://careers.example:444/apply' }, 'origin-changed'],
    [{ url: 'not a URL' }, 'invalid-url'],
    [{ contextKey: 'two' }, 'context-changed'],
  ]) assert.deepEqual(inspect(scope, overrides), { allowed: false, reason, lock: false, pause: true });
  assert.equal(scope.bindContext('two'), false, 'known identity cannot silently rebind');
  assert.equal(inspect(scope, { contextKey: 'one' }).allowed, true);
});

test('idle expiry locks at the deadline and touch cannot revive it', () => {
  const scope = make({ idleMs: 100, maxAgeMs: 1000 });
  assert.equal(inspect(scope, { now: 1099 }).allowed, true);
  assert.deepEqual(inspect(scope, { now: 1100 }), { allowed: false, reason: 'idle-expired', lock: true, pause: false });
  assert.equal(scope.touch(1101), false);
  assert.equal(scope.bindContext('new'), false);
  assert.equal(inspect(scope, { now: 1001 }).allowed, false, 'older timestamps cannot revive latched expiry');
});

test('touch extends idle time only while live and never extends absolute expiry', () => {
  const scope = make({ idleMs: 100, maxAgeMs: 250 });
  assert.equal(scope.touch(1090), true);
  assert.equal(inspect(scope, { now: 1189 }).allowed, true);
  assert.equal(scope.touch(1180), true);
  assert.deepEqual(inspect(scope, { now: 1250 }), { allowed: false, reason: 'session-expired', lock: true, pause: false });
  assert.equal(scope.touch(1251), false);
  const untouched = make({ idleMs: 100 });
  assert.equal(untouched.touch(1100), false, 'touch itself must enforce expiry');
});

test('ending clears permission irreversibly', () => {
  const scope = make(); scope.end();
  assert.deepEqual(inspect(scope), { allowed: false, reason: 'ended', lock: true, pause: false });
  assert.equal(scope.touch(1001), false); assert.equal(scope.bindContext('one'), false);
});

test('only secure origins or loopback HTTP can form a scope', () => {
  for (const origin of ['http://127.0.0.1:47960', 'http://localhost:47960', 'http://[::1]:47960']) {
    const scope = make({ origin });
    assert.equal(inspect(scope, { url: origin + '/contact' }).allowed, true);
  }
  for (const origin of ['http://careers.example', 'file:///tmp/a', 'https://name:secret@careers.example', 'https://careers.example/path']) {
    assert.throws(() => make({ origin }), TypeError);
  }
  for (const options of [{ tabId: '7' }, { tabId: -1 }, { startedAt: NaN }, { idleMs: 0 }, { maxAgeMs: -1 }]) assert.throws(() => make(options), TypeError);
});

test('invalid or backward activity timestamps cannot prolong a scope', () => {
  const scope = make({ idleMs: 100 });
  assert.equal(scope.touch(1090), true);
  assert.equal(scope.touch(1080), false);
  assert.equal(scope.touch(NaN), false);
  assert.equal(inspect(scope, { now: NaN }).allowed, false);
  assert.equal(inspect(scope, { now: 1190 }).lock, true);
});
