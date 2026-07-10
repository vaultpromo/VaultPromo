import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users, accounts, sessions, verificationTokens, authenticators } from "@/db/schema";
import { loginSchema } from "@/lib/validations/auth";

/**
 * Central Auth.js v5 configuration.
 *
 * Export: { handlers, auth, signIn, signOut }
 * - handlers → used in app/api/auth/[...nextauth]/route.ts
 * - auth      → used in Server Components / DAL to get session
 * - signIn    → used in Server Actions
 * - signOut   → used in Server Actions
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
    authenticatorsTable: authenticators,
  }),

  /**
   * Database sessions: session data lives in Postgres.
   * The browser only holds an opaque session token cookie.
   */
  session: { strategy: "database" },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  providers: [
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

        // users registered with credentials have a hashed password stored
        // in the accounts table (provider = "credentials") under access_token
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
      // Attach user id to the session object so Server Components can use it
      if (session.user && user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
