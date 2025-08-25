import { SuperDnsLookupError } from '../../error';
import { HostnameAddressPair } from '../../hosts-file-service';

export class InvalidHostnameAddressPair extends SuperDnsLookupError {
  public constructor(
    public readonly hostsFilePath: string,
    public readonly pair: HostnameAddressPair
  ) {
    super(`Hosts file '${hostsFilePath}' has invalid hostname/address '${pair[0]}'/'${pair[1]}'.`);
  }
}
