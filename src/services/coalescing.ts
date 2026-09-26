// src/services/coalescing.ts

export class RequestCoalescer {
  private inFlight = new Map<string, Promise<any>>();

  /**
   * Coalesces concurrent calls for the same key onto a single active Promise.
   */
  public async execute<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing;
    }

    const promise = factory()
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  public get inFlightCount(): number {
    return this.inFlight.size;
  }
}

export const requestCoalescer = new RequestCoalescer();
