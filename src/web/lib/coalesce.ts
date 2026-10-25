// Runs `fn` one call at a time without losing requests: calls made while it is
// running collapse into exactly one more run once it finishes. Used for
// snapshot fetches, where an update announced mid-fetch must still be fetched.
export function coalesce(fn: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> | null = null;
  let again = false;
  return () => {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      try {
        do {
          again = false;
          await fn();
        } while (again);
      } finally {
        running = null;
      }
    })();
    return running;
  };
}
