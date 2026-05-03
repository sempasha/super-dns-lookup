import { type SocketOptions as UdpSocketOptions, createSocket, Socket as UdpSocket } from 'node:dgram';
import { type Agent as HttpAgent } from 'node:http';
import { type Agent as HttpsAgent } from 'node:https';
import { type TcpNetConnectOpts as TcpSocketOptions, Socket as TcpSocket } from 'node:net';
import { type LookupController, LookupOneCallback, SuperLookupController } from './lookup-controller';

const controller = new SuperLookupController({
  lazyBootstrap: true,
  lazyTeardown: ['SIGHUP', 'SIGINT', 'SIGTERM']
});

/**
 * Statically available {@link SuperLookupController#lookup} method.
 *
 * @example
 * import { lookup } from 'super-dns-lookup';
 * lookup('example.com', console.log);
 */
export const lookup = controller.lookup;

/**
 * Makes [http.Agent](https://nodejs.org/docs/latest/api/http.html#class-httpagent) or [https.Agent](https://nodejs.org/docs/latest/api/https.html#class-httpsagent) to use specified lookup function ({@link LookupController#lookup} for example) to resolve hostname when agent creates new [connection](https://nodejs.org/docs/latest/api/http.html#agentcreateconnectionoptions-callback).
 *
 * @param agent [http.Agent](https://nodejs.org/docs/latest/api/http.html#class-httpagent) or [https.Agent](https://nodejs.org/docs/latest/api/https.html#class-httpsagent) where {@link LookupController#lookup} must be installed and used as `lookup` option during [createConnection](https://nodejs.org/docs/latest/api/http.html#agentcreateconnectionoptions-callback) call.
 * @param lookup Lookup function to use.
 */
export function agentInstall<Agent extends Pick<HttpAgent | HttpsAgent, 'createConnection'>>(
  agent: Agent,
  lookup = controller.lookup
): void {
  const createConnection = agent.createConnection.bind(agent);
  agent.createConnection = (options, callback) => {
    return createConnection({ lookup, ...options }, callback);
  };
}

/**
 * Makes all NodeJS modules to use specified lookup function (for example {@link LookupController#lookup}) to resolve hostname while creating new network connection.
 * Supports http.Agent, https.Agent, net.Socket, net.createConnection, tls.Socket, tls.createConnection and dgram.createSocket.
 *
 * @param lookup Lookup function to use.
 */
export function globalInstall(lookup: LookupController['lookup']): void {
  const tcpConnect = TcpSocket.prototype.connect;
  TcpSocket.prototype.connect = function (this: TcpSocket, ...args: Parameters<TcpSocket['connect']>) {
    if (typeof args[0] === 'object' && args[0] !== null) {
      (args[0] as TcpSocketOptions) = { lookup, ...(args[0] as TcpSocketOptions) };
    }
    return tcpConnect.apply(this, args);
  } as TcpSocket['connect'];

  const ucpConnect = UdpSocket.prototype.connect;
  UdpSocket.prototype.connect = function (this: UdpSocket, ...args: Parameters<UdpSocket['connect']>) {
    setUdpSocketLookup.call(this, lookup);
    return ucpConnect.apply(this, args);
  } as UdpSocket['connect'];

  const ucpSend = UdpSocket.prototype.send;
  UdpSocket.prototype.send = function (this: UdpSocket, ...args: Parameters<UdpSocket['send']>) {
    setUdpSocketLookup.call(this, lookup);
    return ucpSend.apply(this, args);
  } as UdpSocket['send'];

  const ucpBind = UdpSocket.prototype.bind;
  UdpSocket.prototype.bind = function (this: UdpSocket, ...args: Parameters<UdpSocket['bind']>) {
    setUdpSocketLookup.call(this, lookup);
    return ucpBind.apply(this, args);
  } as UdpSocket['bind'];
}

const updSockets = new WeakSet<UdpSocket>();
function setUdpSocketLookup(this: UdpSocket, lookup: Exclude<UdpSocketOptions['lookup'], undefined>) {
  if (updSockets.has(this)) {
    return;
  }
  updSockets.add(this);
  const { handle, type } = getSocketPrivateProperties(this);
  if (handle.lookup.toString() === 'function () { [native code] }') {
    const family = type === 'udp4' ? 4 : 6;
    const defaultAddress = type === 'udp4' ? '127.0.0.1' : '::6';
    handle.lookup = (hostname, callback) => lookup(hostname || defaultAddress, { family }, callback);
  }
}

const stateSymbol = (() => {
  const socket = createSocket({ type: 'udp4' });
  for (const key of Object.getOwnPropertySymbols(socket)) {
    if (key.toString() === 'Symbol(state symbol)') {
      return key;
    }
  }
  throw new Error('Unable to detect Symbol for node:dgram.Socket~Symbol(state symbol).');
})();
function getSocketPrivateProperties(socket: UdpSocket): {
  handle: {
    lookup: (address: string, callback: LookupOneCallback) => void;
  };
  type: UdpSocketOptions['type'];
} {
  if (!('type' in socket)) {
    throw new TypeError('Unable to find node:dgram.Socket~type.');
  }

  const type = socket.type;

  if (typeof type !== 'string' || (type !== 'udp4' && type !== 'udp6')) {
    throw new TypeError(`Socket type (node:dgram.Socket~type) is invalid ("${type}").`);
  }

  if (!(stateSymbol in socket)) {
    throw new TypeError('Unable to find node:dgram.Socket~Symbol(state symbol).');
  }

  // @ts-expect-error ts(7053)
  const state = socket[stateSymbol];

  if (typeof state !== 'object' || state === null) {
    throw new TypeError('Socket state (node:dgram.Socket~Symbol(state symbol)) is not an object.');
  }

  if (!('handle' in state)) {
    throw new TypeError('Socket state (node:dgram.Socket~Symbol(state symbol)) has no handle.');
  }

  const handle = state.handle;

  if (typeof handle !== 'object' || handle === null) {
    throw new TypeError('Socket state (node:dgram.Socket~Symbol(state symbol)) has invalid handle object.');
  }

  if (!('lookup' in handle) || typeof handle.lookup !== 'function') {
    throw new TypeError('Socket handle (node:dgram.Socket~Symbol(state symbol).handle) has no lookup function.');
  }

  return { handle, type };
}
