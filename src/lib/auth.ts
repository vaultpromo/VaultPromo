import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { users, accounts, sessions, verificationTokens, authenticators, profiles } from "@/db/schema";
import { loginSchema } from "@/lib/validations/auth";

/**
 * Central Auth.js v5 configuration.
 *
 * Strategy: "database" — required for OAuth providers (Google).
 * Sessions are stored in the Neon DB via DrizzleAdapter.
 *
 * Credentials provider: looks up the user and verifies bcrypt hash directly,
 * bypassing the adapter's OAuth flow.
 *
 * Google provider: handled entirely by the adapter — creates the user,
 * account, and session automatically on first sign-in.
 *
 * Profile creation: the `signIn` callback creates a default profile row
 * for new users (Google sign-ins) so the dashboard always has a profile.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
    authenticatorsTable: authenticators,
  }),

  session: { strategy: "database" },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  providers: [
    // ── Google OAuth ──────────────────────────────────────────────────────
    // Credentials are optional — the app works without them (Google sign-in
    // disabled if env vars not set). Set GOOGLE_CLIENT_ID and
    // GOOGLE_CLIENT_SECRET to enable.
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
              params: {
                // Request email + profile scopes only — no extra permissions
                scope: "openid email profile",
              },
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
    async session({ session, user }) {
      // With database strategy, `user` is the DB user object
      if (session.user && user) {
        session.user.id = user.id;
      }
      return session;
    },

    async signIn({ user, account }) {
      // For OAuth sign-ins (Google), create a default profile if it doesn't exist
      if (account?.provider === "google" && user.id) {
        const existingProfile = await db.query.profiles.findFirst({
          where: eq(profiles.userId, user.id),
          columns: { id: true },
        });

        if (!existingProfile) {
          await db.insert(profiles).values({
            id: randomUUID(),
            userId: user.id,
            // Use the Google display name as the label name by default
            labelName: user.name ?? null,
            activeWorkspace: "label",
            storageQuotaBytes: "2147483648", // 2 GB (free plan)
            storageUsedBytes: "0",
            planTier: "free",
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
      return true;
    },
  },
});
