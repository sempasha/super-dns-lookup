import { SuperDnsLookupError } from '../../error';

export class HostnameNotFound extends SuperDnsLookupError {
  public readonly code = 'ENOTFOUND';

  public constructor(hostname: string, family: false | 4 | 6) {
    const familyString = family === 4 || family === 6 ? String(family) : 'any';
    super(`super-dns-lookup LookupController#lookup ENOTFOUND ${hostname} (${familyString} family)`);
  }
}
