import { env } from 'node:process';
import { DNSServerControllerClient } from './dns-server-controller';

/**
 * Instance of {@link DNSServerControllerClient} configured to communicate with {@link DNSServer} running in the {@link file://./../bin/dns-server.ts}.
 * Configuration (environment variables) provided by {@link file://./../../docker-compose.yaml}.
 */
export const dnsServer = new DNSServerControllerClient({
  ip: env.DNS_SERVER_CONTROLLER_IP!,
  port: parseInt(env.DNS_SERVER_CONTROLLER_PORT!)
});
