import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { users, accounts, profiles } from "@/db/schema";
import { loginSchema } from "@/lib/validations/auth";

/**
 * Auth.js v5 — JWT strategy.
 *
 * JWT strategy is required for Credentials provider to work.
 * Google OAuth is handled by creating/finding the user manually in the
 * signIn callback, then returning the user id in the JWT.
 *
 * No DrizzleAdapter — we manage users and profiles ourselves for both
 * providers. This avoids the Credentials + database strategy incompatibility.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  providers: [
    // ── Google OAuth ──────────────────────────────────────────────────────
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
              params: { scope: "openid email profile" },
            },
          }),
        ]
      : []),

    // ── Email + Password ──────────────────────────────────────────────────
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await db.query.users.findFirst({
          where: eq(users.email, email.toLowerCase()),
        });
        if (!user) return null;

        const credAccount = await db.query.accounts.findFirst({
          where: eq(accounts.userId, user.id),
        });
        if (!credAccount?.access_token) return null;

        const passwordMatch = await bcrypt.compare(password, credAccount.access_token);
        if (!passwordMatch) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],

  callbacks: {
    /**
     * JWT callback — runs on every sign-in and session access.
     * For Google: find-or-create the user + profile in our DB.
     * For Credentials: user.id is already set by authorize().
     */
    async jwt({ token, user, account, profile }) {
      // On initial sign-in, `user` is populated
      if (user) {
        token.id = user.id;
      }

      // Google sign-in: find-or-create user in our DB
      if (account?.provider === "google" && profile?.email) {
        const email = profile.email.toLowerCase();

        let dbUser = await db.query.users.findFirst({
          where: eq(users.email, email),
          columns: { id: true, name: true, email: true },
        });

        if (!dbUser) {
          // New Google user — create user + profile
          const userId = randomUUID();
          await db.insert(users).values({
            id: userId,
            name: (profile.name as string) ?? null,
            email,
            emailVerified: new Date(),
            image: (profile.picture as string) ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          await db.insert(accounts).values({
            userId,
            type: "oauth",
            provider: "google",
            providerAccountId: account.providerAccountId,
            access_token: account.access_token ?? null,
            refresh_token: account.refresh_token ?? null,
            expires_at: account.expires_at ?? null,
            token_type: account.token_type ?? null,
            scope: account.scope ?? null,
            id_token: account.id_token ?? null,
          });

          await db.insert(profiles).values({
            id: randomUUID(),
            userId,
            labelName: (profile.name as string) ?? null,
            activeWorkspace: "label",
            planTier: "free",
            storageQuotaBytes: String(2 * 1024 ** 3),
            storageUsedBytes: "0",
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          token.id = userId;
        } else {
          token.id = dbUser.id;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
