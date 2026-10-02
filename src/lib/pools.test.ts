import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SOLO_POOLS,
  knownPoolToConfig,
  getKnownPoolForConfig,
  isSameTrustedPool,
  hasSameEndpoint,
  isDuplicatePoolEndpoint,
  createEmptyCustomPool,
  getNextCustomPoolName,
  getDuplicatePoolEndpointIndexes,
} from './pools';
import { isValidPoolAuthorityPubkey } from './utils';

test('solo pool presets are sorted alphabetically', () => {
  const names = SOLO_POOLS.map((pool) => pool.name);

  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
});

test('CKPool preset matches its SV2 solo endpoint', () => {
  const ckPool = SOLO_POOLS.find((pool) => pool.id === 'ckpool');

  assert.ok(ckPool);
  assert.deepEqual(knownPoolToConfig(ckPool), {
    name: 'CKPool',
    address: 'stratum.ckpool.org',
    port: 3336,
    authority_public_key: '9anrRNhBh7869XtNnFcCuGBRZP51E635qGbu457J5kHdszhfRc3',
    user_identity: '',
  });
  assert.equal(
    `stratum2+tcp://${ckPool.address}:${ckPool.port}/${ckPool.authority_public_key}`,
    'stratum2+tcp://stratum.ckpool.org:3336/9anrRNhBh7869XtNnFcCuGBRZP51E635qGbu457J5kHdszhfRc3',
  );
  assert.equal(isValidPoolAuthorityPubkey(ckPool.authority_public_key), true);
  assert.equal(ckPool.monogram, 'CK');
  assert.equal(ckPool.logoUrl, undefined);
});

test('an unverified display name cannot establish trusted pool identity', () => {
  const attackerSuppliedConfig = {
    name: 'Braiins Pool',
    address: 'attacker.example',
    port: 3333,
    authority_public_key: '',
  };

  assert.equal(getKnownPoolForConfig(attackerSuppliedConfig), null,
    'a user-controlled name alone must not grant official pool branding');
});

test('correct address and port with wrong authority key must not receive official branding', () => {
  const wrongAuthorityConfig = {
    name: 'Braiins Pool',
    address: 'stratum.braiins.com',
    port: 3333,
    authority_public_key: '1111111111111111111111111111111111111111111111111111111111111111',
  };

  assert.equal(getKnownPoolForConfig(wrongAuthorityConfig), null,
    'an official endpoint with a forged authority key must not receive official pool branding');
});

test('getKnownPoolForConfig returns the preset for a fully matching config', () => {
  const known = SOLO_POOLS[0];
  const config = {
    name: known.name,
    address: known.address,
    port: known.port,
    authority_public_key: known.authority_public_key,
  };

  assert.equal(getKnownPoolForConfig(config)?.id, known.id,
    'a config with matching address, port and authority key resolves to the known pool');
});

test('isSameTrustedPool requires address, port and authority key to all match', () => {
  const a = { address: 'pool.example', port: 3333, authority_public_key: 'KEY' };
  const sameKey = { address: 'pool.example', port: 3333, authority_public_key: 'KEY' };
  const wrongKey = { address: 'pool.example', port: 3333, authority_public_key: 'OTHER' };
  const wrongPort = { address: 'pool.example', port: 3334, authority_public_key: 'KEY' };

  assert.equal(isSameTrustedPool(a, sameKey), true);
  assert.equal(isSameTrustedPool(a, wrongKey), false, 'different authority key is not the same trusted pool');
  assert.equal(isSameTrustedPool(a, wrongPort), false, 'different port is not the same trusted pool');
  assert.equal(isSameTrustedPool(a, null), false, 'null is never the same trusted pool');
  assert.equal(isSameTrustedPool(null, a), false, 'null is never the same trusted pool');
  assert.equal(isSameTrustedPool(a, { ...a, address: 'POOL.EXAMPLE' }), true, 'address comparison is case-insensitive');
});

test('hasSameEndpoint compares address and port only, ignoring authority key', () => {
  const a = { address: 'pool.example', port: 3333 };
  const sameEndpoint = { address: 'pool.example', port: 3333 };
  const wrongKey = { address: 'pool.example', port: 3333, authority_public_key: 'OTHER' };
  const wrongPort = { address: 'pool.example', port: 3334 };

  assert.equal(hasSameEndpoint(a, sameEndpoint), true);
  assert.equal(hasSameEndpoint(a, { ...wrongKey }), true, 'endpoint match ignores the authority key');
  assert.equal(hasSameEndpoint(a, wrongPort), false, 'different port is a different endpoint');
  assert.equal(hasSameEndpoint(a, null), false);
  assert.equal(hasSameEndpoint(a, { ...a, address: 'POOL.EXAMPLE' }), true, 'address comparison is case-insensitive');
});

test('isDuplicatePoolEndpoint collapses same-endpoint entries regardless of key', () => {
  const correct = { address: 'pool.example', port: 3333, authority_public_key: 'KEY' };
  const wrongKey = { address: 'pool.example', port: 3333, authority_public_key: 'OTHER' };

  assert.equal(isDuplicatePoolEndpoint(correct, wrongKey), true,
    'a wrong-key entry at a known endpoint is still a duplicate and must not be re-added');
  assert.equal(isDuplicatePoolEndpoint(correct, { ...correct, port: 3334 }), false);
});

test('getNextCustomPoolName gives each additional custom pool a unique name', () => {
  assert.equal(getNextCustomPoolName([]), 'Custom Pool');

  const first = createEmptyCustomPool('', getNextCustomPoolName([]));
  const second = createEmptyCustomPool('', getNextCustomPoolName([first]));
  const third = createEmptyCustomPool('', getNextCustomPoolName([first, second]));

  assert.deepEqual([first.name, second.name, third.name], ['Custom Pool', 'Custom Pool 2', 'Custom Pool 3']);
});

test('getNextCustomPoolName reuses the lowest free suffix', () => {
  const remaining = [{ name: 'Custom Pool' }, { name: 'Custom Pool 3' }];

  assert.equal(getNextCustomPoolName(remaining), 'Custom Pool 2');
  assert.equal(getNextCustomPoolName([{ name: 'Custom Pool 2' }]), 'Custom Pool',
    'the unsuffixed name is reused once it is free');
});

test('getDuplicatePoolEndpointIndexes allows several empty custom pools', () => {
  const pools = [createEmptyCustomPool(), createEmptyCustomPool('', 'Custom Pool 2'), createEmptyCustomPool('', 'Custom Pool 3')];

  assert.equal(getDuplicatePoolEndpointIndexes(pools).size, 0);
});

test('getDuplicatePoolEndpointIndexes flags every pool sharing an endpoint', () => {
  const preset = knownPoolToConfig(SOLO_POOLS[0]);
  const pools = [
    { ...createEmptyCustomPool(), address: 'Pool.Example.com', port: 3333 },
    preset,
    { ...createEmptyCustomPool('', 'Custom Pool 2'), address: 'pool.example.com', port: 3333 },
    { ...createEmptyCustomPool('', 'Custom Pool 3'), address: 'pool.example.com', port: 4444 },
  ];

  assert.deepEqual([...getDuplicatePoolEndpointIndexes(pools)].sort(), [0, 2],
    'same address (case-insensitive) and port is a duplicate; a different port is not');
});
