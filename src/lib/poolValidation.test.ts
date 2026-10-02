import assert from 'node:assert/strict';
import test from 'node:test';

import type { BitcoinNetwork, MiningMode, PoolConfig } from '@sv2-ui/shared';

import {
  buildSriIdentity,
  getPoolIdentityError,
  getWorkerNameError,
  SRI_POOL_AUTHORITY_KEY,
} from './miningIdentity';
import { hasDuplicatePoolEndpoints, isPoolFormValid, isPoolComplete } from './poolValidation';

const NETWORK: BitcoinNetwork = 'mainnet';

// Standard BIP173 P2WPKH test vector — valid on mainnet.
const PAYOUT_ADDRESS = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';

function makeSriSoloPool(userIdentity: string): PoolConfig {
  return {
    name: 'SRI Pool',
    address: 'sri.pool.example',
    port: 3333,
    authority_public_key: SRI_POOL_AUTHORITY_KEY,
    user_identity: userIdentity,
  };
}

test('isPoolFormValid accepts a pool whose injection-shaped worker name was sanitized', () => {
  // buildSriIdentity strips slashes from the `25/...` shape before storage,
  // so the persisted identity alone looks perfectly valid.
  const sanitized = buildSriIdentity(PAYOUT_ADDRESS, `25/${PAYOUT_ADDRESS}`, 0);
  assert.ok(!sanitized.includes('//'), 'sanitizer must have removed the slash');
  const pool = makeSriSoloPool(sanitized);

  assert.equal(isPoolComplete(pool, 'solo', NETWORK), true);
  assert.equal(
    isPoolFormValid({ pools: [pool], miningMode: 'solo', network: NETWORK }),
    true,
    'stored-only validity cannot see the raw invalid input (the blind spot)',
  );
});

test('isPoolFormValid blocks when an identity field reports a displayed error', () => {
  const sanitized = buildSriIdentity(PAYOUT_ADDRESS, `25/${PAYOUT_ADDRESS}`, 0);
  const pool = makeSriSoloPool(sanitized);
  const reportedErrors = { 0: 'Worker name must not contain "/"' };

  assert.equal(
    isPoolFormValid({ pools: [pool], miningMode: 'solo', network: NETWORK, reportedErrors }),
    false,
    'a value displaying an error must never be submittable',
  );
  assert.equal(
    isPoolFormValid({ pools: [pool], miningMode: 'solo', network: NETWORK, reportedErrors: { 0: null } }),
    true,
    'a cleared report must unblock again',
  );
});

test('isPoolFormValid blocks slash-containing stored identities without any report', () => {
  // Ordinary slash names survive verbatim in the identity and are caught by
  // identity-level validation alone.
  const pool = makeSriSoloPool(buildSriIdentity(PAYOUT_ADDRESS, 'rig/1', 0));
  assert.equal(isPoolComplete(pool, 'solo', NETWORK), false);
  assert.equal(
    isPoolFormValid({ pools: [pool], miningMode: 'solo', network: NETWORK }),
    false,
  );
});

test('isPoolFormValid validates primary and fallback pools with per-index reports', () => {
  const clean = buildSriIdentity(PAYOUT_ADDRESS, 'worker1', 0);
  const primary = makeSriSoloPool(clean);
  const fallback = { ...makeSriSoloPool(clean), address: 'sri-fallback.pool.example' };

  assert.equal(
    isPoolFormValid({
      pools: [primary, fallback],
      miningMode: 'solo',
      network: NETWORK,
      reportedErrors: { 0: null, 1: null },
    }),
    true,
  );
  assert.equal(
    isPoolFormValid({
      pools: [primary, fallback],
      miningMode: 'solo',
      network: NETWORK,
      reportedErrors: { 1: 'Worker name must not contain "/"' },
    }),
    false,
    'a reported error on a fallback pool blocks the form',
  );

  const brokenFallback = { ...makeSriSoloPool(''), address: 'sri-fallback.pool.example' };
  assert.equal(
    isPoolFormValid({ pools: [primary, brokenFallback], miningMode: 'solo', network: NETWORK }),
    false,
    'identity-level validation still applies to every pool',
  );
});

test('isPoolFormValid requires at least one pool and ignores unrelated report keys', () => {
  const clean = makeSriSoloPool(buildSriIdentity(PAYOUT_ADDRESS, '', 0));

  assert.equal(isPoolFormValid({ pools: [], miningMode: 'solo', network: NETWORK }), false);
  assert.equal(
    isPoolFormValid({
      pools: [clean],
      miningMode: 'solo',
      network: NETWORK,
      reportedErrors: { 5: 'stale key beyond the pool list' },
    }),
    true,
  );
});

test('getPoolIdentityError surfaces the raw worker-name error behind a sanitized identity', () => {
  const pool = makeSriSoloPool(buildSriIdentity(PAYOUT_ADDRESS, `25/${PAYOUT_ADDRESS}`, 25));

  assert.equal(
    getPoolIdentityError(pool, 'solo', NETWORK),
    null,
    'without the raw name the sanitized identity passes (why gating needs the report)',
  );
  assert.equal(
    getPoolIdentityError(pool, 'solo', NETWORK, `25/${PAYOUT_ADDRESS}`),
    'Worker name must not contain "/"',
  );
  assert.equal(getWorkerNameError(`25/${PAYOUT_ADDRESS}`), 'Worker name must not contain "/"');
});

test('reported errors gate every supported form mode without changing stored validation', () => {
  const usernamePool: PoolConfig = {
    ...makeSriSoloPool(''),
    user_identity: 'username.worker1',
  };
  const modes: Array<MiningMode | null> = ['pool', null];
  for (const mode of modes) {
    assert.equal(
      isPoolFormValid({
        pools: [usernamePool],
        miningMode: mode,
        network: NETWORK,
        reportedErrors: { 0: 'displayed error' },
      }),
      false,
      `mode ${String(mode)}: reported error blocks`,
    );
    assert.equal(
      isPoolFormValid({ pools: [usernamePool], miningMode: mode, network: NETWORK }),
      true,
      `mode ${String(mode)}: valid stored identity passes`,
    );
  }
});

test('isPoolFormValid accepts multiple distinct custom pools and rejects duplicate endpoints', () => {
  const primary = makeSriSoloPool(buildSriIdentity(PAYOUT_ADDRESS, '', 0));
  const customA: PoolConfig = {
    name: 'Custom Pool',
    address: 'pool-a.example.com',
    port: 3333,
    authority_public_key: '9anrRNhBh7869XtNnFcCuGBRZP51E635qGbu457J5kHdszhfRc3',
    user_identity: PAYOUT_ADDRESS,
  };
  const customB: PoolConfig = { ...customA, name: 'Custom Pool 2', address: 'pool-b.example.com' };
  const customC: PoolConfig = { ...customA, name: 'Custom Pool 3', address: '10.0.0.5', port: 3334 };

  assert.equal(
    isPoolFormValid({ pools: [primary, customA, customB, customC], miningMode: 'solo', network: NETWORK }),
    true,
  );

  const duplicate: PoolConfig = { ...customA, name: 'Custom Pool 4' };
  assert.equal(hasDuplicatePoolEndpoints([primary, customA, duplicate]), true);
  assert.equal(
    isPoolFormValid({ pools: [primary, customA, duplicate], miningMode: 'solo', network: NETWORK }),
    false,
  );
});
