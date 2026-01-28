/**
 * Returns promise which resolves right after given time.
 * Does nothing during that time.
 *
 * @param timeMs
 */
export async function delay(timeMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, timeMs);
  });
}
