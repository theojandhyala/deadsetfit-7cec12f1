// OAuth removed — auth uses direct Supabase email/password
export const lovable = {
  auth: {
    signInWithOAuth: async (_provider: string, _opts?: unknown) => {
      return { error: new Error("OAuth not configured") };
    },
  },
};
