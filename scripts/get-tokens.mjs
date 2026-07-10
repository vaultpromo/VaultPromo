import { config } from "dotenv";
config({ path: ".env.local" });
import pg from "pg";
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const res = await client.query(`
  SELECT cd.id, cd.delivery_token, cd.campaign_id, c.email, cd.email_sent_at, cd.email_opened_at
  FROM campaign_distributions cd
  JOIN contacts c ON cd.contact_id = c.id
  ORDER BY cd.created_at DESC
  LIMIT 10
`);

const appUrl = "http://localhost:3000";

for (const row of res.rows) {
  const newLink = `${appUrl}/api/promo/enter?token=${row.delivery_token}&campaign=${row.campaign_id}`;
  console.log(`Email:   ${row.email}`);
  console.log(`Link:    ${newLink}`);
  console.log(`Sent:    ${row.email_sent_at ?? "not sent"}`);
  console.log(`Opened:  ${row.email_opened_at ?? "not opened"}`);
  console.log("---");
}

await client.end();
