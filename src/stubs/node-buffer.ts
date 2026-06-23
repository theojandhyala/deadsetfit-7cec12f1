// Browser stub for node:buffer — only Buffer.from(...).toString('hex') is used in stripe.server.ts
export const Buffer = {
  from(data: Uint8Array): { toString(encoding: string): string } {
    return {
      toString(encoding: string): string {
        if (encoding === "hex") {
          return Array.from(data)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        }
        throw new Error(`Buffer.from stub: unsupported encoding ${encoding}`);
      },
    };
  },
};
