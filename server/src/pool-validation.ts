import { isTomlSafeIdentifier, isValidPoolAddress, isValidPoolAuthorityPubkey } from '@sv2-ui/shared';
import type { PoolConfig } from './types.js';

const MAX_POOL_NAME_LENGTH = 128;
const MAX_POOL_ADDRESS_LENGTH = 255;
const MAX_AUTHORITY_KEY_LENGTH = 128;
const MAX_IDENTITY_LENGTH = 512;
export { MAX_FALLBACK_POOLS } from '@sv2-ui/shared';

function isSafeBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' &&
    value.length <= maxLength &&
    isTomlSafeIdentifier(value);
}

export function getPoolConfigError(pool: PoolConfig, label: string): string | null {
  if (typeof pool.name !== 'string' || pool.name.length === 0 || pool.name.length > MAX_POOL_NAME_LENGTH) {
    return `${label} name is required and must be at most ${MAX_POOL_NAME_LENGTH} characters`;
  }
  if (!isSafeBoundedString(pool.address, MAX_POOL_ADDRESS_LENGTH) || !isValidPoolAddress(pool.address)) {
    return `${label} address is required and cannot contain quotes, backslashes, control characters, or surrounding whitespace, and must be a valid IP or FQDN`;
  }
  if (!Number.isInteger(pool.port) || pool.port <= 0 || pool.port > 65535) {
    return `${label} port must be between 1 and 65535`;
  }
  if (pool.jds_port !== undefined && (
    !Number.isInteger(pool.jds_port) || pool.jds_port <= 0 || pool.jds_port > 65535
  )) {
    return `${label} JD port must be between 1 and 65535`;
  }
  if (!isSafeBoundedString(pool.authority_public_key, MAX_AUTHORITY_KEY_LENGTH) || !isValidPoolAuthorityPubkey(pool.authority_public_key)) {
    return `${label} authority public key is invalid`;
  }
  if (!isSafeBoundedString(pool.user_identity, MAX_IDENTITY_LENGTH)) {
    return `${label} username is required and cannot contain quotes, backslashes, control characters, or surrounding whitespace`;
  }
  return null;
}
