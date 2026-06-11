import { randomUUID } from 'node:crypto';
import { createSocket, type RemoteInfo, type Socket } from 'node:dgram';
import { Resolver } from 'node:dns/promises';
import {
  BADFAMILY,
  BADFLAGS,
  BADHINTS,
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
  NOTINITIALIZED,
  NOTIMP,
  REFUSED,
  SERVFAIL,
  TIMEOUT
} from 'node:dns';
import { isIPv4, isIPv6 } from 'node:net';
import { EventEmitter } from 'node:stream';
import { decode, encode } from 'dns-packet';
import { toRcode } from 'dns-packet/rcodes';
import { type RequireAtLeastOne } from 'type-fest';
import './dns-packet-rcodes';

/**
 * Error codes specific for client side request processing
 */
export type DNSClientError =
  | typeof BADFAMILY
  | typeof BADFLAGS
  | typeof BADHINTS
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
 * These error codes may be used to simulate {@link DNSServer} failure.
 */
export type DNSServerError = typeof FORMERR | typeof NOTFOUND | typeof NOTIMP | typeof REFUSED | typeof SERVFAIL;

/**
 * This value means {@link DNSServer} should forward request to NodeJS built-in resolver.
 */
export type DNSServerForward = 'forward to node.dns';

/**
 * IP address structure may be to simulate positive hostname resolution by {@link DNSServer}.
 */
export type DNSAddress = [address: string, ttl: number];

/**
 * {@link DNSServer} response specification: error code, or list of A/AAAA records with TTL specified for each address.
 */
export type DNSResponse =
  | DNSServerError
  | DNSServerForward
  | RequireAtLeastOne<{
      A: DNSAddress[] | DNSServerError;
      AAAA: DNSAddress[] | DNSServerError;
    }>;

/**
 * {@link DNSServer} options.
 */
export interface DNSServerOptions {
  /**
   * List of default responses.
   * Responses from this list survives {@link DNSServer#reset} call.
   */
  defaultResponses?: (
    | {
        respondAlways: Parameters<DNSServer['respondAlways']>;
      }
    | {
        respondOnce: Parameters<DNSServer['respondOnce']>;
      }
    | {
        respondTimes: Parameters<DNSServer['respondTimes']>;
      }
  )[];

  /**
   * Ip address where server expects DNS request to be sent
   */
  ip: string;

  /**
   * The port where server expects DNS request to be sent
   */
  port: number;
}

type RequestData = {
  class?: string;
  id: string;
  name: string;
  type: string;
};

type ResponseData = {
  addresses?: [string, number][];
  code: string;
};

export type DNSServerErrorEvent = { request: Pick<RequestData, 'id'>; error: unknown };

export type DNSServerRequestEvent = { request: RequestData };

export type DNSServerResponseEvent = { request: Pick<RequestData, 'id'>; response: ResponseData };

export type DNSServerEvents = {
  error: [DNSServerErrorEvent];
  request: [DNSServerRequestEvent];
  response: [DNSServerResponseEvent];
};

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
export class DNSServer extends EventEmitter<DNSServerEvents> {
  protected readonly messageHandler: (msg: Buffer, rinfo: RemoteInfo) => void;
  protected readonly options: DNSServerOptions;
  protected readonly resolver: Resolver;
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
    this.messageHandler = this.handleMessage.bind(this);
    this.options = options;
    this.resolver = new Resolver();
    if (isIPv4(options.ip)) {
      this.socket = createSocket('udp4');
    } else if (isIPv6(options.ip)) {
      this.socket = createSocket('udp6');
    } else {
      throw new Error('Specified IP address is not a valid IPv4/IPv6');
    }
    this.reset();
  }

  /**
   * Starts listening the specified UDP ip:port to capture DNS request messages.
   */
  public async bootstrap() {
    const { ip, port } = this.options;
    await new Promise<void>((resolve, reject) => {
      this.socket.once('error', reject);
      this.socket.once('listening', () => {
        this.socket.off('error', reject);
        this.socket.on('message', this.messageHandler);
        resolve();
      });
      this.socket.bind(port, ip);
    });
  }

  /**
   * Stops listening the specified UDP port, no more DNS requests will be handled after teardown has been called.
   */
  public async teardown() {
    await new Promise<void>((resolve) => {
      this.socket.close(() => {
        this.socket.off('message', this.messageHandler);
        resolve();
      });
    });
  }

  /**
   * Makes server to forget all schedules responses.
   */
  public reset() {
    this.responses.clear();
    if (this.options.defaultResponses) {
      for (const item of this.options.defaultResponses) {
        if ('respondAlways' in item) {
          this.respondAlways(...item.respondAlways);
        } else if ('respondOnce' in item) {
          this.respondOnce(...item.respondOnce);
        } else {
          this.respondTimes(...item.respondTimes);
        }
      }
    }
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
   * Handles UDP messages received by DNS request.
   * This method is fully compatible with {@link https://nodejs.org/docs/latest/api/dgram.html#event-message|message event of UDP server}.
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
   * When request should be forwarded to node.dns module, resolves hostname using {@link https://nodejs.org/docs/latest/api/dns.html#resolveroptions|NodeJS build-in resolver}.
   * Emit request and response events with given requestId when no error.
   * Emit error event each time request handling failed with error.
   *
   * @param buffer Incoming message buffer
   * @param options Remote client requisites
   */
  protected async handleMessage(incomingMessage: Buffer, { address, port }: { address: string; port: number }) {
    const id = randomUUID();
    try {
      const request = this.parseMessage(incomingMessage);
      this.emit('request', {
        request: {
          id,
          name: request.name,
          type: request.type
        }
      });
      const response = await this.prepareResponse(request);
      this.emit('response', {
        request: { id },
        response: {
          code: response.code,
          addresses: 'addresses' in response ? response.addresses : undefined
        }
      });
      const outgoingMessage = this.serializeResponse(request, response);
      this.socket.send(outgoingMessage, port, address);
    } catch (error) {
      this.emit('error', { request: { id }, error });
    }
  }

  /**
   * Reads DNS request from incoming message buffer.
   * Throws an error when non query message received.
   * Throws an error when there is no questions in query or there are more then one question.
   * Throws an error when query has class other then "IN".
   * Throws an error when question type other then "A" and "AAAA".
   * @param message Incoming message buffer
   * @returns Parsed request
   */
  protected parseMessage(message: Buffer): {
    class?: 'IN';
    id?: number;
    name: string;
    type: 'A' | 'AAAA';
  } {
    const request = decode(message);

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

    return {
      class: questionClass,
      id: request.id,
      name: questionName,
      type: questionType
    };
  }

  /**
   * Prepares response based on request and server's configuration.
   * When no response configured, returns 'NXDOMAIN' response code.
   * When response code is configured, returns it.
   * When addresses configured, returns them with 'NOERROR' code.
   * @param request Request parsed by {@link DNSServer#parseMessage}.
   * @returns Response, ready for serialization by {@link DNSServer#serializeResponse}.
   */
  protected async prepareResponse(request: ReturnType<typeof this.parseMessage>): Promise<
    | {
        code: 'FORMERR' | 'NXDOMAIN' | 'NOTIMP' | 'REFUSED' | 'SERVFAIL';
      }
    | {
        code: 'NOERROR';
        addresses: [string, number][];
      }
  > {
    const responseCandidates = this.responses.get(request.name);
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
        if (candidate.response === 'forward to node.dns') {
          try {
            const result = await (request.type === 'A'
              ? this.resolver.resolve4(request.name, { ttl: true })
              : this.resolver.resolve6(request.name, { ttl: true }));
            response = result.map(({ address, ttl }) => [address, ttl]);
          } catch (error) {
            response = this.getForwardingErrorCode(error);
          }
        } else if (typeof candidate.response === 'string') {
          response = candidate.response;
        } else if (!(request.type in candidate.response)) {
          response = [];
        } else {
          response = candidate.response[request.type]!;
        }
      }
    }

    if (!response) {
      response = 'ENOTFOUND';
    }

    if (typeof response === 'string') {
      const code = (
        {
          EFORMERR: 'FORMERR',
          ENOTFOUND: 'NXDOMAIN',
          ENOTIMP: 'NOTIMP',
          EREFUSED: 'REFUSED',
          ESERVFAIL: 'SERVFAIL'
        } as const
      )[response];

      return { code };
    }

    return { code: 'NOERROR', addresses: response };
  }

  /**
   * Extracts error code from forwarding error, i.e. from error occurred while calling.
   * When it is impossible to extract error from from error, returns ESERVFAIL code.
   * @param error Forwarding error
   * @returns Error code
   */
  protected getForwardingErrorCode(error: unknown): DNSServerError | never[] {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      if (error.code === 'ENODATA') {
        return [];
      }
      const codes: DNSServerError[] = ['EFORMERR', 'ENOTFOUND', 'ENOTIMP', 'EREFUSED', 'ESERVFAIL'];
      if (codes.includes(error.code as DNSServerError)) {
        return error.code as DNSServerError;
      }
    }
    return 'ESERVFAIL';
  }

  /**
   * Serializes response into outgoing DNS server message.
   * @param request Request parsed by {@link DNSServer#parseMessage}.
   * @param response Response prepared by {@link DNSServer#prepareResponse}.
   * @returns Outgoing message buffer.
   */
  protected serializeResponse(
    request: ReturnType<typeof this.parseMessage>,
    response: Awaited<ReturnType<typeof this.prepareResponse>>
  ): Buffer {
    const { class: cls, id, name, type } = request;
    const { code } = response;
    const questions = [{ class: cls, name, type }];
    if ('addresses' in response) {
      const { addresses } = response;
      return encode({
        answers: addresses.map(([address, ttl]) => ({
          class: cls,
          data: address,
          name,
          ttl,
          type
        })),
        id: id,
        flags: toRcode('NOERROR'),
        type: 'response',
        questions
      });
    }
    return encode({
      id: id,
      type: 'response',
      flags: toRcode(code),
      questions
    });
  }
}
