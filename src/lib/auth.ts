import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { authConfig } from "./auth.config";
import { rateLimit } from "./rate-limit";
import { auditLog } from "./audit";

const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    ...(googleEnabled
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: false,
          }),
        ]
      : []),
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const key = `login:${String(credentials.username).toLowerCase()}`;
        const rl = rateLimit(key, 5, 15 * 60 * 1000);
        if (!rl.allowed) {
          await auditLog({ action: 'login_failed', details: { reason: 'rate_limited', username: credentials.username } });
          throw new Error("Too many attempts. Try again in 15 minutes.");
        }

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { username: credentials.username as string },
              { email: credentials.username as string },
            ],
            isActive: true,
          },
        });

        if (!user) {
          await auditLog({ action: 'login_failed', details: { reason: 'user_not_found', username: credentials.username } });
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) {
          await auditLog({ userId: user.id, action: 'login_failed', details: { reason: 'wrong_password' } });
          return null;
        }

        await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
        await auditLog({ userId: user.id, action: 'login_success' });

        return {
          id: String(user.id),
          name: user.fullName,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" && profile?.email) {
        const existing = await prisma.user.findFirst({
          where: {
            OR: [
              { googleId: account.providerAccountId },
              { email: profile.email },
            ],
          },
        });

        if (existing) {
          if (!existing.googleId) {
            await prisma.user.update({
              where: { id: existing.id },
              data: {
                googleId: account.providerAccountId,
                emailVerified: true,
                avatarUrl: (profile as { picture?: string }).picture || existing.avatarUrl,
                lastLogin: new Date(),
              },
            });
          } else {
            await prisma.user.update({ where: { id: existing.id }, data: { lastLogin: new Date() } });
          }
          (user as { id: string }).id = String(existing.id);
          (user as { role: string }).role = existing.role;
          return true;
        }

        const names = (profile.name || profile.email).split(" ");
        const firstName = names[0] || "";
        const lastName = names.slice(1).join(" ") || "";
        const username = profile.email.split("@")[0] + "_" + Math.random().toString(36).slice(2, 6);

        const created = await prisma.user.create({
          data: {
            username,
            email: profile.email,
            firstName,
            lastName,
            fullName: profile.name || profile.email,
            passwordHash: "",
            googleId: account.providerAccountId,
            emailVerified: true,
            avatarUrl: (profile as { picture?: string }).picture,
            role: "user",
            lastLogin: new Date(),
          },
        });
        (user as { id: string }).id = String(created.id);
        (user as { role: string }).role = created.role;
        return true;
      }
      return true;
    },
  },
});