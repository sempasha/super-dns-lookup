import { homepage } from '../package.json';

/**
 * Generate documentation link for given urlPath string.
 *
 * @param urlPath Relative path of documentation.
 * @returns Generated documentation URL.
 */
export function getDocsUrl(relativePath: string): string {
  return `${homepage}/docs/${relativePath}`;
}
