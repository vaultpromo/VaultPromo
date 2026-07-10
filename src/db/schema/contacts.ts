import { pgTable, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Mailing lists owned by a label user.
 * A list can be used across multiple campaigns.
 */
export const mailingLists = pgTable("mailing_lists", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Individual contacts (DJs, radio hosts, press).
 * Scoped to the label user who added them.
 */
export const contacts = pgTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name"),
    alias: text("alias"), // DJ alias / handle
    city: text("city"),
    country: text("country"),
    notes: text("notes"),
    // Has the contact ever opted out? Hard-stop for all sends.
    unsubscribed: boolean("unsubscribed").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    // Composite unique: one email per label user (no duplicate imports)
    index("contacts_user_email_idx").on(table.userId, table.email),
  ],
);

/**
 * Junction: which contacts belong to which mailing list.
 */
export const mailingListContacts = pgTable(
  "mailing_list_contacts",
  {
    mailingListId: text("mailing_list_id")
      .notNull()
      .references(() => mailingLists.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("mailing_list_contacts_idx").on(table.mailingListId, table.contactId)],
);
