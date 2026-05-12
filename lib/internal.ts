import { createSocket, Socket as UdpSocket, type SocketOptions as UdpSocketOptions } from 'node:dgram';
import { Socket as TcpSocket, type TcpSocketConnectOpts as TcpSocketOptions } from 'node:net';
import { homepage } from '../package.json';
import { LookupController, LookupOneCallback } from './lookup-controller';

/**
 * Generate documentation link for given urlPath string.
 *
 * @param urlPath Relative path of documentation.
 * @returns Generated documentation URL.
 */
export function getDocsUrl(relativePath: string): string {
  return `${homepage}/docs/${relativePath}`;
}
