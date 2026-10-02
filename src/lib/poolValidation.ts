import type { BitcoinNetwork, MiningMode, PoolConfig } from '@sv2-ui/shared';
import { getPoolIdentityError } from './miningIdentity';
import { getDuplicatePoolEndpointIndexes } from './pools';
import { isValidPoolAuthorityPubkey, isValidPoolAddress } from './utils';

export function isPoolConnectionComplete(pool: PoolConfig | null | undefined): boolean {
  return Boolean(
    pool?.address &&
    isValidPoolAddress(pool.address) &&
    Number.isInteger(pool.port) &&
    pool.port > 0 &&
    pool.port <= 65535 &&
    (pool.jds_port === undefined || (
      Number.isInteger(pool.jds_port) && pool.jds_port > 0 && pool.jds_port <= 65535
    )) &&
    isValidPoolAuthorityPubkey(pool.authority_public_key),
  );
}

// True if any two pools share the same address and port.
export function hasDuplicatePoolEndpoints(
  pools: Array<PoolConfig | null | undefined>,
): boolean {
  return getDuplicatePoolEndpointIndexes(pools).size > 0;
}

export function isPoolComplete(
  pool: PoolConfig | null | undefined,
  miningMode: MiningMode | null,
  network: BitcoinNetwork,
): boolean {
  return Boolean(
    isPoolConnectionComplete(pool) &&
    !getPoolIdentityError(pool, miningMode, network),
  );
}

export interface PoolFormValidityInput {
  /** Ordered pool list; index 0 is the primary pool. */
  pools: Array<PoolConfig | null | undefined>;
  miningMode: MiningMode | null;
  network: BitcoinNetwork;
  /**
   * Blocking identity errors reported per pool index by identity field
   * components. Some invalid inputs (e.g. an injection-shaped worker name
   * such as `25/<address>`) are sanitized before they reach the stored
   * identity, so `isPoolComplete` alone cannot see them; the field surfaces
   * them here so a value displaying an error can never be submitted.
   */
  reportedErrors?: Record<number, string | null | undefined>;
}

export function isPoolFormValid({
  pools,
  miningMode,
  network,
  reportedErrors,
}: PoolFormValidityInput): boolean {
  if (pools.length === 0) return false;
  if (hasDuplicatePoolEndpoints(pools)) return false;

  return pools.every((pool, index) => (
    isPoolComplete(pool, miningMode, network) && !reportedErrors?.[index]
  ));
}
