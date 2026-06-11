import {
  type IncomingMessage as HTTPIncomingMessage,
  type ServerResponse as HTTPServerResponse,
  Server as HTTPServer,
  request as createRequest
} from 'node:http';
import { Ajv, type Schema } from 'ajv';
import { type ArrayValues, type ValueOf } from 'type-fest';
import { DNSResponse, type DNSServer } from './dns-server';
import EventEmitter from 'node:events';

/**
 * JSON representation of HTTP error
 */
interface HttpErrorJson {
  error: {
    cause: string;
    message: string;
  };
}

/**
 * HTTP error should be used by {@link DNSServer} controller to describe error response.
 */
class HttpError extends Error {
  public constructor(
    public readonly statusCode: 400 | 405 | 406,
    public readonly cause: string,
    public readonly headers?: Record<string, string>
  ) {
    const messages = {
      400: 'Bad Request',
      405: 'Method Not Allowed',
      406: 'Not Acceptable'
    };
    super(messages[statusCode], { cause });
  }

  /**
   * Method represents error serialization to JSON.
   */
  public toJSON(): HttpErrorJson {
    return {
      error: {
        cause: this.cause,
        message: this.message
      }
    };
  }
}

/**
 * Control methods of DNSServer
 * @example
 * import { ControlRequest } from './dns-server-controller'
 *
 * const respondAlways: ControlRequest = {
 *   method: 'respondAlways',
 *   parameters: ['example.com', ['192.168.0.1', 600]]
 * };
 * const respondOnce: ControlRequest = {
 *   method: 'respondOnce',
 *   parameters: ['example.com', ['192.168.0.2', 3600]]
 * };
 * const respondTimes: ControlRequest = {
 *   method: 'respondTimes',
 *   parameters: [2, 'example.com', ['192.168.0.7', 7200]]
 * };
 */
export type ControlRequest = ValueOf<{
  [Method in ArrayValues<DNSServerController['controlMethodNames']>]: {
    method: Method;
    parameters: Parameters<DNSServer[Method]>;
  };
}>;

export interface DNSServerControllerOptions {
  /**
   * Ip address, controller's http server will be listening to.
   */
  ip: string;

  /**
   * Port number, controller's http server will be listening to.
   */
  port: number;
}

/**
 * Client for {@link DNSServerController} built on top of NodeJS's http module
 */
export class DNSServerControllerClient
  implements Pick<DNSServer, ArrayValues<DNSServerController['controlMethodNames']>>
{
  protected readonly ajv = new Ajv();

  public constructor(protected readonly options: DNSServerControllerOptions) {}

  /**
   * Calls {@link DNSServer#reset} via {@link DNSServerController} controller.
   *
   * @see DNSServer#reset
   * @returns Promise of successful {@link DNSServer#reset} execution.
   */
  public reset(): Promise<void> {
    return this.sendRequest({
      method: 'reset',
      parameters: []
    });
  }

  /**
   * Calls {@link DNSServer#respondAlways} via {@link DNSServerController} controller.
   *
   * @see DNSServer#respondAlways
   * @param hostname Requested hostname.
   * @param response Planned response.
   * @returns Promise of successful {@link DNSServer#respondAlways} execution.
   */
  public respondAlways(hostname: string, response: DNSResponse): Promise<void> {
    return this.sendRequest({
      method: 'respondAlways',
      parameters: [hostname, response]
    });
  }

  /**
   * Calls {@link DNSServer#respondOnce} via {@link DNSServerController} controller.
   *
   * @see DNSServer#respondOnce
   * @param hostname Requested hostname.
   * @param response Planned response.
   * @returns Promise of successful {@link DNSServer#respondOnce} execution.
   */
  public respondOnce(hostname: string, response: DNSResponse): Promise<void> {
    return this.sendRequest({
      method: 'respondOnce',
      parameters: [hostname, response]
    });
  }

  /**
   * Calls {@link DNSServer#respondTimes} via {@link DNSServerController} controller.
   *
   * @see DNSServer#respondTimes
   * @param times Number of response repetitions.
   * @param hostname Requested hostname.
   * @param response Planned response.
   * @returns Promise of successful {@link DNSServer#respondTimes} execution.
   */
  public respondTimes(times: number, hostname: string, response: DNSResponse): Promise<void> {
    return this.sendRequest({
      method: 'respondTimes',
      parameters: [times, hostname, response]
    });
  }

  /**
   * Performs HTTP request to {@link DNSServerController}'s HTTP server.
   * Suggests successful request if response with status code is 200.
   * Throws an error with message "Invalid response type." when response content type is not an "application/json".
   * Throws an error with message "Unable to parse response." when response is not a valid JSON.
   * Throws an error with the same message and cause as {@link DNSServerController} specified in response.
   *
   * @param controlRequest Controller HTTP Request body.
   * @returns Promise of successful {@link DNSServer} control method execution.
   */
  protected sendRequest(controlRequest: ControlRequest): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = createRequest({
        host: this.options.ip,
        headers: {
          Connection: 'close',
          'Content-Type': 'application/json'
        },
        method: 'POST',
        port: this.options.port
      });
      request.once('error', reject);
      request.on('response', (response) => {
        if (response.statusCode === 200) {
          return resolve();
        }
        if (
          !('content-type' in response.headers) ||
          !response.headers['content-type']?.startsWith('application/json')
        ) {
          return reject(new Error('Invalid response type.'));
        }

        const chunks: Buffer[] = [];
        response.on('data', (chunk) => {
          chunks.push(chunk);
        });
        response.on('error', (error) => {
          reject(new Error('Response failed', { cause: error }));
        });
        response.on('end', () => {
          let response: unknown;
          try {
            response = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            this.assertErrorResponse(response);
            const { cause, message } = response.error;
            reject(new Error(message, { cause }));
          } catch (error) {
            reject(new Error('Unable to parse response.', { cause: error }));
          }
        });
      });
      request.write(JSON.stringify(controlRequest));
      request.end();
    });
  }

  /**
   * JSON Schema for control requests.
   */
  protected readonly errorResponseSchema: Schema = {
    properties: {
      error: {
        properties: {
          cause: { type: 'string' },
          message: { type: 'string' }
        },
        required: ['cause', 'message'],
        type: 'object'
      }
    },
    required: ['error'],
    type: 'object'
  };

  /**
   * Validate request and returns nothing in case value is a valid control request.
   * Throws an error when value is not a valid control request.
   * @param value
   */
  protected assertErrorResponse(value: unknown): asserts value is HttpErrorJson {
    const valid = this.ajv.validate(this.errorResponseSchema, value);
    if (!valid) {
      throw this.ajv.errorsText;
    }
  }
}

/**
 * {@link DNSServerController} gives an ability to control {@link DNSServer} remotely by calling control methods via HTTP.
 * Control methods are:
 *
 *  - {@link DNSServer#reset};
 *  - {@link DNSServer#respondAlways};
 *  - {@link DNSServer#respondOnce};
 *  - {@link DNSServer#respondTimes}.
 */
export class DNSServerController extends EventEmitter<{
  error: [unknown];
  request: [{ body?: unknown; method: string; url: string }];
  response: [{ status: number }];
}> {
  protected readonly ajv = new Ajv({ allErrors: true, discriminator: true });
  protected readonly controlMethodNames = ['reset', 'respondAlways', 'respondOnce', 'respondTimes'] as const;
  protected readonly httpServer: HTTPServer;
  protected readonly requestHandler: (request: HTTPIncomingMessage, response: HTTPServerResponse) => void;

  /**
   * Creates instance of DNSServer
   * @param dnsServer {@link DNSServer}
   */
  public constructor(
    protected readonly dnsServer: DNSServer,
    protected readonly options: DNSServerControllerOptions
  ) {
    super();
    this.httpServer = new HTTPServer({
      keepAlive: false,
      keepAliveInitialDelay: 0,
      keepAliveTimeout: 0
    });
    this.requestHandler = this.handleRequest.bind(this);
  }

  /**
   * Starts listening the specified TCP ip:port to capture HTTP control requests.
   */
  public async bootstrap(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const { httpServer } = this;
      httpServer.on('request', this.requestHandler);
      httpServer.once('error', reject);
      httpServer.listen(
        {
          host: this.options.ip,
          port: this.options.port
        },
        () => {
          httpServer.off('error', reject);
          resolve();
        }
      );
    });
  }

  /**
   * Stops listening the specified TCP ip:port, no more HTTP requests will be handled after teardown has been called.
   */
  public async teardown(): Promise<void> {
    const { httpServer } = this;
    if (httpServer.listening) {
      await new Promise((resolve, reject) => {
        httpServer.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve(error);
          }
        });
      });
    }
  }

  /**
   * Handles HTTP control request and apply them to {@link DNSServer}.
   * Rejects non POST requests with 405 status code.
   * Rejects non JSON requests with 406 status code.
   * Rejects any request which has no "method" and "parameters" properties in body.
   * Accept request with method of "reset" and empty parameters array {@link DNSServer#reset} replying with 200 status code.
   * Calls {@link DNSServer#reset} every time reset method requested.
   * Accept request with method of "respondAlways" tuple of hostname and DNSResponse parameters replying with 200 status code.
   * Calls {@link DNSServer#respondAlways} with specified parameters every time respondAlways method requested.
   * Accept request with method of "respondOnce" tuple of hostname and DNSResponse parameters replying with 200 status code.
   * Calls {@link DNSServer#respondOnce} with specified parameters every time respondOnce method requested.
   * Accept request with method of "respondTimes" tuple of number of times, hostname and DNSResponse parameters replying with 200 status code.
   * Calls {@link DNSServer#respondTimes} with specified parameters every time respondTimes method requested.
   * @param request HTTP request
   * @param response HTTP response
   * @returns Nothing
   */
  protected handleRequest(request: HTTPIncomingMessage, response: HTTPServerResponse): void {
    const responseHeaders = { 'content-type': 'application/json' };
    const { headers, method = 'UNKNOWN', url = '/' } = request;
    let requestEmitted = false;
    const sendError = (error: HttpError) => {
      if (!requestEmitted) {
        this.emit('request', { method, url });
      }
      this.emit('response', { status: error.statusCode });
      response.writeHead(error.statusCode, { ...responseHeaders, ...error.headers });
      response.end(JSON.stringify(error));
    };
    if (method !== 'POST') {
      return sendError(new HttpError(405, 'Only POST method supported'));
    }
    if (!('content-type' in headers) || !headers['content-type']?.startsWith('application/json')) {
      return sendError(
        new HttpError(406, 'Only application/json supported', { accept: responseHeaders['content-type'] })
      );
    }

    const chunks: Buffer[] = [];
    request.on('data', (chunk) => {
      chunks.push(chunk);
    });
    request.on('end', () => {
      let body: unknown;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch (error) {
        return sendError(new HttpError(400, 'Unable to parse request body as JSON.'));
      }
      requestEmitted = true;
      this.emit('request', { body, method, url });
      try {
        this.assertControlRequest(body);
      } catch (error) {
        return sendError(new HttpError(400, `Unable to recognize control request: ${error}`));
      }
      let result: unknown;
      try {
        // @ts-expect-error: A spread argument must either have a tuple type or be passed to a rest parameter
        result = this.dnsServer[body.method](...body.parameters);
      } catch (error) {
        return sendError(new HttpError(400, `Control request failed with error: ${error}`));
      }
      this.emit('response', { status: 200 });
      response.writeHead(200, responseHeaders);
      response.end(JSON.stringify({ result: result ?? null }));
    });
  }

  /**
   * JSON Schema for control requests.
   */
  protected readonly controlRequestSchemas: Schema = {
    $defs: {
      DNSAddress: {
        additionalItems: false,
        items: [
          {
            title: 'ip address',
            type: 'string'
          },
          {
            title: 'ttl',
            minimum: 1,
            type: 'integer'
          }
        ],
        maxItems: 2,
        minItems: 2,
        type: 'array'
      },
      DNSAddresses: {
        items: {
          $ref: '#/$defs/DNSAddress'
        },
        minItems: 1,
        type: 'array'
      },
      DNSServerError: {
        enum: ['FORMERR', 'NOTFOUND', 'NOTIMP', 'REFUSED', 'SERVFAIL'],
        type: 'string'
      },
      DNSServerForward: {
        const: 'forward to node.dns',
        type: 'string'
      },
      DNSServerErrorOrAddresses: {
        oneOf: [
          {
            $ref: '#/$defs/DNSAddresses'
          },
          {
            $ref: '#/$defs/DNSServerError'
          }
        ]
      },
      hostname: {
        title: 'hostname parameter',
        type: 'string'
      },
      response: {
        oneOf: [
          {
            $ref: '#/$defs/DNSServerError'
          },
          {
            $ref: '#/$defs/DNSServerForward'
          },
          {
            anyOf: [
              {
                properties: {
                  A: {
                    $ref: '#/$defs/DNSServerErrorOrAddresses'
                  }
                },
                required: ['A'],
                type: 'object'
              },
              {
                properties: {
                  AAAA: {
                    $ref: '#/$defs/DNSServerErrorOrAddresses'
                  }
                },
                required: ['AAAA'],
                type: 'object'
              }
            ]
          }
        ],
        title: 'response parameter'
      },
      times: {
        minimum: 1,
        title: 'times parameter',
        type: 'integer'
      }
    },
    oneOf: [
      {
        properties: {
          method: {
            const: 'reset',
            type: 'string'
          },
          parameters: {
            maxItems: 0,
            type: 'array'
          }
        }
      },
      {
        properties: {
          method: {
            const: 'respondAlways',
            type: 'string'
          },
          parameters: {
            additionalItems: false,
            items: [
              {
                $ref: '#/$defs/hostname'
              },
              {
                $ref: '#/$defs/response'
              }
            ],
            maxItems: 2,
            minItems: 2,
            type: 'array'
          }
        }
      },
      {
        properties: {
          method: {
            const: 'respondOnce',
            type: 'string'
          },
          parameters: {
            additionalItems: false,
            items: [
              {
                $ref: '#/$defs/hostname'
              },
              {
                $ref: '#/$defs/response'
              }
            ],
            maxItems: 2,
            minItems: 2,
            type: 'array'
          }
        }
      },
      {
        properties: {
          method: {
            const: 'respondTimes',
            type: 'string'
          },
          parameters: {
            additionalItems: false,
            items: [
              {
                $ref: '#/$defs/times'
              },
              {
                $ref: '#/$defs/hostname'
              },
              {
                $ref: '#/$defs/response'
              }
            ],
            maxItems: 3,
            minItems: 3,
            type: 'array'
          }
        }
      }
    ],
    properties: {
      method: {
        enum: ['reset', 'respondAlways', 'respondOnce', 'respondTimes'],
        type: 'string'
      },
      parameters: {
        items: {},
        type: 'array'
      }
    },
    required: ['method', 'parameters'],
    type: 'object'
  };

  /**
   * Validate request and returns nothing in case value is a valid control request.
   * Throws an error when value is not a valid control request.
   * @param value
   */
  protected assertControlRequest(value: unknown): asserts value is ControlRequest {
    const valid = this.ajv.validate(this.controlRequestSchemas, value);
    if (!valid) {
      throw this.ajv.errorsText;
    }
  }
}
