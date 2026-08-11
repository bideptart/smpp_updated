import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe NextAuth configuration.
 *
 * This file is imported by `middleware.ts` which runs on the Edge runtime
 * (no Node.js crypto / fs / bcrypt allowed). Keep it free of server-only
 * imports. The full config (with Credentials + Prisma + bcrypt) lives in
 * `auth.ts`.
 */
export const authConfig: NextAuthConfig = {
  providers: [], // Populated in auth.ts (Node runtime) — empty here is fine for the middleware.
  trustHost: true, // Running behind Apache reverse proxy — accept the forwarded Host header
  session: { strategy: "jwt", maxAge: 3600 },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as unknown as { role: string }).role = token.role as string;
        (session.user as unknown as { id: string }).id = token.userId as string;
      }
      return session;
    },
    authorized({ auth }) {
      return !!auth;
    },
  },
};
