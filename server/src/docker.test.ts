import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import Docker from 'dockerode';

import { getBitcoinRpcProbeTransports, getDockerConnectionInfo, normalizeDockerError, getStackStatus } from './docker.js';
import { DockerConnectionError } from './docker-errors.js';

test('Bitcoin RPC probing tries host loopback before Docker host gateway', () => {
  assert.deepEqual(getBitcoinRpcProbeTransports(), [
    {
      name: 'host-loopback',
      host: '127.0.0.1',
      networkMode: 'host',
    },
    {
      name: 'docker-host-gateway',
      host: 'host.docker.internal',
      networkMode: 'bridge',
      extraHosts: ['host.docker.internal:host-gateway'],
    },
  ]);
});

test('normalizeDockerError handles non-Error objects', () => {
  const result = normalizeDockerError('Just a string');
  assert.equal(result.message, 'Just a string');
});

test('normalizeDockerError passes through unrelated errors', () => {
  const err = new TypeError('Cannot read properties of undefined (reading \'id\')');
  const result = normalizeDockerError(err);
  assert.equal(result, err);
});

test('normalizeDockerError passes through docker daemon HTTP errors', () => {
  const err = Object.assign(new Error('Internal Server Error'), { statusCode: 500 });
  const result = normalizeDockerError(err);
  assert.equal(result, err);
});

test('normalizeDockerError formats ECONNREFUSED with no available sockets', (t) => {
  t.mock.method(fs, 'existsSync', () => false);
  const err = new Error('connect ECONNREFUSED');
  (err as NodeJS.ErrnoException).code = 'ECONNREFUSED';

  const result = normalizeDockerError(err);

  assert.match(result.message, /^Docker is not reachable/);
  assert.match(result.message, /Ensure Docker Engine or Docker Desktop is running/);
});

test('normalizeDockerError formats ECONNREFUSED with available sockets and filters current endpoint', (t) => {
  // Mock existsSync to always return true, meaning all paths are technically "available".
  // The filtering logic inside normalizeDockerError should successfully exclude the *current*
  // default endpoint from the "Other available sockets" list.
  // Note: We return false for '/.dockerenv' to test the non-Docker environment message.
  t.mock.method(fs, 'existsSync', (p: string | Buffer | URL) => String(p) !== '/.dockerenv');

  const err = new Error('connect ECONNREFUSED');
  (err as NodeJS.ErrnoException).code = 'ECONNREFUSED';

  const result = normalizeDockerError(err);

  assert.match(result.message, /^Docker is not reachable/);
  assert.match(result.message, /Ensure Docker Engine or Docker Desktop is running/);
  assert.match(result.message, /Other available sockets found:/);
  
  // The current endpoint should not be in the list of *other* available sockets
  const otherSockets = result.message.split('Other available sockets found:')[1];
  assert.ok(!otherSockets.includes('/var/run/docker.sock'));
  assert.ok(otherSockets.includes('.docker'));
});

test('normalizeDockerError formats EACCES to hint at permissions', () => {
  const err = new Error('connect EACCES');
  (err as NodeJS.ErrnoException).code = 'EACCES';

  const result = normalizeDockerError(err);

  assert.match(result.message, /^Permission denied when accessing Docker/);
  assert.match(result.message, /Check file permissions or ensure your user is in the 'docker' group/);
});

test('normalizeDockerError formats SSH failures with proper hints', () => {
  const err = new Error('ssh connection failed');
  Object.assign(err, { level: 'client-authentication' });

  const result = normalizeDockerError(err);
  assert.match(result.message, /\[client-authentication\]/);
  assert.match(result.message, /Ensure the SSH user, key, and host are correct/);
});

test('normalizeDockerError appends container hints when inside docker', (t) => {
  // Mock fs.existsSync to return true only for /.dockerenv
  t.mock.method(fs, 'existsSync', (p: fs.PathLike) => p === '/.dockerenv');

  const err = new Error('connect ECONNREFUSED');
  (err as NodeJS.ErrnoException).code = 'ECONNREFUSED';

  // The local socket default applies, which triggers the 'isSocket' true branch
  const result = normalizeDockerError(err);
  assert.match(result.message, /Ensure Docker Engine or Docker Desktop is running/);
  assert.match(result.message, /Also ensure the socket volume is mounted into this container/);
});

test('normalizeDockerError suggests checking DOCKER_SOCKET_PATH or DOCKER_HOST when no sockets are found', (t) => {
  // Ensure no other sockets are found
  t.mock.method(fs, 'existsSync', (_p: fs.PathLike) => false);
  
  const err = new Error('connect ENOENT');
  (err as NodeJS.ErrnoException).code = 'ENOENT';
  
  const result = normalizeDockerError(err);
  assert.match(result.message, /Or check your DOCKER_SOCKET_PATH \/ DOCKER_HOST endpoint\./);
});

test('getStackStatus throws normalized error on ECONNREFUSED', async (t) => {
  const err = new Error('connect ECONNREFUSED');
  (err as NodeJS.ErrnoException).code = 'ECONNREFUSED';

  let callCount = 0;
  t.mock.method(Docker.prototype, 'getContainer', () => {
    return {
      inspect: async () => { callCount++; throw err; }
    };
  });

  await assert.rejects(
    async () => { await getStackStatus('no-jd'); },
    (error: Error) => error instanceof DockerConnectionError && error.message.includes('Docker is not reachable')
  );
  assert.equal(callCount, 1);
});

test('getStackStatus returns null on 404 (missing container)', async (t) => {
  const err = new Error('HTTP code 404 from docker');
  Object.assign(err, { statusCode: 404, reason: 'no such container', json: { message: 'No such container: jd' } });

  t.mock.method(Docker.prototype, 'getContainer', () => {
    return {
      inspect: async () => { throw err; }
    };
  });

  const status = await getStackStatus('jd');
  assert.equal(status.translator, null);
  assert.equal(status.jdc, null);
});

test('getStackStatus rejects with DockerConnectionError on HTML proxy 404', async (t) => {
  const err = new Error('HTTP 404 Not Found');
  Object.assign(err, { statusCode: 404 });

  t.mock.method(Docker.prototype, 'getContainer', () => {
    return {
      inspect: async () => { throw err; }
    };
  });

  await assert.rejects(
    async () => await getStackStatus('jd'),
    (error: Error) => error instanceof DockerConnectionError && error.message.includes('not a Docker daemon')
  );
});

test('normalizeDockerError passes through Docker-shaped 404s unchanged', () => {
  const err = new Error('HTTP code 404 from docker');
  Object.assign(err, { statusCode: 404, json: { message: 'manifest for some-image:latest not found' } });
  
  const result = normalizeDockerError(err);
  assert.equal(result, err);
});

test('Docker connection metadata never exposes URL credentials', () => {
  const previousHost = process.env.DOCKER_HOST;
  const previousSocketPath = process.env.DOCKER_SOCKET_PATH;
  const password = 'docker-password-must-stay-secret';

  try {
    delete process.env.DOCKER_SOCKET_PATH;
    process.env.DOCKER_HOST = `https://docker-user:${password}@127.0.0.1:2376`;

    const serializedConnection = JSON.stringify(getDockerConnectionInfo());

    assert.doesNotMatch(serializedConnection, new RegExp(password));
    assert.match(serializedConnection, /docker-user/, 'the username stays for a faithful display');
  } finally {
    if (previousHost === undefined) delete process.env.DOCKER_HOST;
    else process.env.DOCKER_HOST = previousHost;

    if (previousSocketPath === undefined) delete process.env.DOCKER_SOCKET_PATH;
    else process.env.DOCKER_SOCKET_PATH = previousSocketPath;

    // Re-resolve the cached connection against the restored environment.
    getDockerConnectionInfo();
  }
});

test('a malformed DOCKER_HOST does not leak credentials through the thrown error', () => {
  const previousHost = process.env.DOCKER_HOST;
  const previousSocketPath = process.env.DOCKER_SOCKET_PATH;
  const password = 'docker-password-must-stay-secret';

  try {
    delete process.env.DOCKER_SOCKET_PATH;
    process.env.DOCKER_HOST = `https://docker-user:${password}@127.0.0.1:notaport`;

    let thrown: unknown;
    try {
      getDockerConnectionInfo();
    } catch (error) {
      thrown = error;
    }

    assert.ok(thrown instanceof Error, 'expected the malformed DOCKER_HOST to be rejected');
    // The whole serialized error is checked so neither the message nor any
    // extra property (ERR_INVALID_URL attaches the raw URL as `input`) can
    // carry the credential.
    assert.doesNotMatch(JSON.stringify(thrown), new RegExp(password));
  } finally {
    if (previousHost === undefined) delete process.env.DOCKER_HOST;
    else process.env.DOCKER_HOST = previousHost;

    if (previousSocketPath === undefined) delete process.env.DOCKER_SOCKET_PATH;
    else process.env.DOCKER_SOCKET_PATH = previousSocketPath;

    // Re-resolve the cached connection against the restored environment.
    getDockerConnectionInfo();
  }
});

test('getStackStatus rejects with a standard Error when inspect throws 500', async (t) => {
  const err = new Error('HTTP code 500 from docker');
  Object.assign(err, { statusCode: 500, reason: 'server error' });

  t.mock.method(Docker.prototype, 'getContainer', () => {
    return {
      inspect: async () => { throw err; }
    };
  });

  await assert.rejects(
    async () => await getStackStatus('jd'),
    (error: Error) => {
      assert.strictEqual(error.message, 'HTTP code 500 from docker');
      assert.strictEqual(error instanceof DockerConnectionError, false);
      return true;
    }
  );
});

test('normalizeDockerError maps ABORT_ERR to timeout message', () => {
  const err = new Error('The operation was aborted');
  (err as NodeJS.ErrnoException).code = 'ABORT_ERR';

  const result = normalizeDockerError(err);
  assert.ok(result instanceof DockerConnectionError);
  assert.match(result.message, /^Docker did not respond within 10 s at/);
});

test('normalizeDockerError maps proxy 404 to DockerConnectionError', () => {
  const err = new Error('HTTP 404 from Nginx');
  Object.assign(err, { statusCode: 404 });

  const result = normalizeDockerError(err);
  assert.ok(result instanceof DockerConnectionError);
  assert.match(result.message, /is not a Docker daemon \(HTTP 404\)/);
});
