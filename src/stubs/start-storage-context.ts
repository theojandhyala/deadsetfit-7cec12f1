// Browser stub for @tanstack/start-storage-context — uses AsyncLocalStorage (Node only)
export const getStartContext = (_opts?: { throwIfNotFound?: boolean }): null => null;
export const runWithStartContext = async (_context: unknown, fn: () => unknown): Promise<unknown> =>
  fn();
