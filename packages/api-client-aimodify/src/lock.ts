// Lock/Unlock mechanism for API client instances

export class LockManager {
  private isLocked = false;
  private waitQueue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];

  /**
   * Lock the instance. All new requests will wait until unlock is called.
   */
  lock(): void {
    this.isLocked = true;
  }

  /**
   * Unlock the instance. All waiting requests will be released.
   */
  unlock(): void {
    this.isLocked = false;
    // Release all waiting requests
    const queue = [...this.waitQueue];
    this.waitQueue = [];
    queue.forEach(({ resolve }) => resolve());
  }

  /**
   * Wait for the lock to be released if the instance is locked.
   * Returns a promise that resolves when the lock is released.
   */
  async waitIfLocked(): Promise<void> {
    if (!this.isLocked) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      this.waitQueue.push({ resolve, reject });
    });
  }

  /**
   * Check if the instance is currently locked.
   */
  get locked(): boolean {
    return this.isLocked;
  }

  /**
   * Clear all waiting requests (useful for cleanup).
   */
  clear(): void {
    const queue = [...this.waitQueue];
    this.waitQueue = [];
    queue.forEach(({ reject }) =>
      reject(new Error('Lock manager cleared'))
    );
  }
}

