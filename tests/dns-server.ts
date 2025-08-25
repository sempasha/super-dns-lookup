import { createSocket, type RemoteInfo, type Socket } from 'node:dgram';
import {
  BADFAMILY,
  BADHINTS,
  BADFLAGS,
  BADNAME,
  BADQUERY,
  BADRESP,
  BADSTR,
  CANCELLED,
  CONNREFUSED,
  FORMERR,
  NODATA,
  NOMEM,
  NONAME,
  NOTFOUND,
  NOTIMP,
  NOTINITIALIZED,
  REFUSED,
  SERVFAIL,
  TIMEOUT
} from 'node:dns';
import { isIPv4, isIPv6 } from 'node:net';
import { EventEmitter } from 'node:stream';
import { type DecodedPacket, type Packet, decode, encode } from 'dns-packet';
import { toRcode } from 'dns-packet/rcodes';
import { type RequireAtLeastOne } from 'type-fest';
import './dns-packet-rcodes';

/**
 * Error codes specific for client side request processing
 */
export type DNSClientError =
  | typeof BADFAMILY
  | typeof BADHINTS
  | typeof BADFLAGS
  | typeof BADNAME
  | typeof BADQUERY
  | typeof BADRESP
  | typeof BADSTR
  | typeof CANCELLED
  | typeof CONNREFUSED
  | typeof NODATA
  | typeof NOMEM
  | typeof NONAME
  | typeof NOTINITIALIZED
  | typeof TIMEOUT;

/**
 * Error codes specific for server side request processing
 */
export type DNSServerError = typeof FORMERR | typeof NOTFOUND | typeof NOTIMP | typeof REFUSED | typeof SERVFAIL;

export type DNSAddress = [address: string, ttl: number];

/**
 * {@link DNSServer} response specification: error code, or list of A/AAAA records with TTL specified for each address.
 */
export type DNSResponse =
  | DNSServerError
  | RequireAtLeastOne<{
      A: DNSAddress[] | DNSServerError;
      AAAA: DNSAddress[] | DNSServerError;
    }>;

/**
 * {@link DNSServer} options.
 */
export interface DNSServerOptions {
  /**
   * Ip address where server expects DNS request to be sent
   */
  ip: string;

  /**
   * The port where server expects DNS request to be sent
   */
  port: number;
}

/**
 * DNS server which should be used for testing purposes only.
 *
 * @example
 * import { equal } from 'node:assert';
 * import dns from 'node:dns/promises';
 * import { DNSServer } from './dns-server';
 *
 * const dnsServer = new DNSServer({ ip: '127.0.0.1 });
 * dnsServer.respondOn('example.com', 0, ['23.220.75.245', 600])
 * await dnsServer.bootstrap();
 * dns.setServers([dnsServer.address]);
 * equal(await dns.resolve('example.com'), ['23.220.75.245']);
 * equal(await dns.resolve('example.com', { ttl: true }), [{ address: '23.220.75.245', ttl: 600 }]);
 * await dnsServer.teardown();
 */
export class DNSServer extends EventEmitter {
  protected readonly handleMessage: (msg: Buffer, rinfo: RemoteInfo) => void;
  protected readonly options: DNSServerOptions;
  protected readonly responses: Map<
    string,
    {
      readonly response: DNSResponse;
      readonly useTimes: number;
      usedTimes: number;
    }[]
  > = new Map();
  protected readonly socket: Socket;

  /**
   * Creates instance of DNSServer
   * @param options {@link DNSServerOptions}
   */
  public constructor(options: DNSServerOptions) {
    super();
    this.options = options;
    if (isIPv4(options.ip)) {
      this.socket = createSocket('udp4');
    } else if (isIPv6(options.ip)) {
      this.socket = createSocket('udp6');
    } else {
      throw new Error('Specified IP address is not a valid IPv4/IPv6');
    }
    this.handleMessage = (buffer: Buffer, { address, port }: { address: string; port: number }) => {
      try {
        const request = decode(buffer);
        const response = this.handleRequest(request);
        this.socket.send(encode(response), port, address);
      } catch (error) {
        this.emit('error', error);
      }
    };
  }

  /**
   * Starts listening the incoming requests on specified ip:port.
   */
  public async bootstrap() {
    const { ip, port } = this.options;
    await new Promise<void>((resolve, reject) => {
      this.socket.once('error', reject);
      this.socket.once('listening', () => {
        this.socket.off('error', reject);
        this.socket.on('message', this.handleMessage);
        resolve();
      });
      this.socket.bind(port, ip);
    });
  }

  /**
   * Stops listening the incoming requests on specified ip:port, no more requests will be handled after teardown.
   */
  public async teardown() {
    await new Promise<void>((resolve) => {
      this.socket.close(() => {
        this.socket.off('message', this.handleMessage);
        resolve();
      });
    });
  }

  /**
   * Makes server to respond with given response given number of times.
   *
   * @param times Number of response repetitions.
   * @param hostname Requested hostname.
   * @param response Planned response.
   */
  public respondTimes(times: number, hostname: string, response: DNSResponse) {
    let responses = this.responses.get(hostname);
    if (!responses) {
      responses = [];
      this.responses.set(hostname, responses);
    }
    responses.push({ response, usedTimes: 0, useTimes: times });
  }

  /**
   * Makes server to always respond with given response.
   * This is simple alias on {@link DNSServer#respondTimes} called with given response and times=Infinity.
   *
   * @param hostname Requested hostname.
   * @param response Planned response.
   */
  public respondAlways(hostname: string, response: DNSResponse) {
    this.respondTimes(Infinity, hostname, response);
  }

  /**
   * Makes server to respond with given response only once.
   * This is simple alias on {@link DNSServer#respondTimes} called with given response and times=1.
   *
   * @param hostname Requested hostname.
   * @param response Planned response.
   */
  public respondOnce(hostname: string, response: DNSResponse) {
    this.respondTimes(1, hostname, response);
  }

  /**
   * Handles client DNS request.
   * Supports only query packets handling.
   * Supports only queries with at least one question in it.
   * Supports only single question in request.
   * Supports only questions about "IN" record classes.
   * Supports only questions about "A"/"AAAA" record types.
   * When no answer configured via {@link DNSServer#respondAlways}/{@link DNSServer#respondOnce}/{@link DNSServer#respondTimes}, returns NX answer (ENOTFOUND).
   * When answer configured via {@link DNSServer#respondAlways}/{@link DNSServer#respondOnce}/{@link DNSServer#respondTimes}, returns this answer.
   * When answer has been configured as error code, then returns corresponding error.
   * When answer has been configured as A records, then returns them.
   * When answer has been configured as AAAA records, then returns them.
   *
   *
   * @param request Client request, DNS request Packet with single question: A/AAAA.
   * @returns Response, DNS response Packet.
   */
  protected handleRequest(request: DecodedPacket): Packet {
    if (request.type !== 'query') {
      throw new Error(`DNSServer expects only "query" packets, got "${request.type}"`);
    }
    if (!request.questions || request.questions.length === 0) {
      throw new Error('DNSServer expects question in query, got nothing');
    }
    if (request.questions.length > 1) {
      throw new Error(`DNSServer expects only one question in query, got ${request.questions.length}`);
    }

    const { class: questionClass, name: questionName, type: questionType } = request.questions[0]!;

    if (questionClass && questionClass !== 'IN') {
      throw new Error(`DNSServer supports only questions of class "IN", got "${questionClass}"`);
    }
    if (questionType !== 'A' && questionType !== 'AAAA') {
      throw new Error(`DNSServer supports only questions of type "A" or "AAAA", got "${questionType}"`);
    }

    const responseCandidates = this.responses.get(questionName);
    let response: DNSServerError | DNSAddress[] | undefined;

    while (!response && responseCandidates && responseCandidates.length > 0) {
      const candidate = responseCandidates[0]!;
      if (candidate.useTimes <= candidate.usedTimes) {
        responseCandidates.shift();
      } else {
        candidate.usedTimes++;
        if (candidate.useTimes === candidate.usedTimes) {
          responseCandidates.shift();
        }
        if (typeof candidate.response === 'string') {
          response = candidate.response;
        } else if (!(questionType in candidate.response)) {
          response = 'ENOTFOUND';
        } else {
          response = candidate.response[questionType]!;
        }
      }
    }

    if (!response) {
      response = 'ENOTFOUND';
    }

    if (typeof response === 'string') {
      const rCode = (
        {
          EFORMERR: 'FORMERR',
          ENOTFOUND: 'NXDOMAIN',
          ENOTIMP: 'NOTIMP',
          EREFUSED: 'REFUSED',
          ESERVFAIL: 'SERVFAIL'
        } as Record<DNSServerError, Parameters<typeof toRcode>[0]>
      )[response];

      return {
        type: 'response',
        id: request.id,
        flags: toRcode(rCode),
        questions: request.questions
      };
    }

    return {
      type: 'response',
      id: request.id,
      flags: toRcode('NOERROR'),
      questions: request.questions,
      answers: response.map(([address, ttl]) => ({
        class: questionClass,
        data: address,
        name: questionName,
        ttl,
        type: questionType
      }))
    };
  }
}
