import fs from "node:fs";
import pg from "pg";

const data = JSON.parse(
  fs.readFileSync(".temp/tokyo-export.json", "utf8")
);
const client = new pg.Client({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

let ok = 0;
for (const row of data.public.profiles) {
  await client.query(
    `insert into public.profiles (id, full_name, phone, role, created_at, updated_at)
     values ($1,$2,$3,$4::public.user_role,$5,$6)
     on conflict (id) do update set
       full_name = excluded.full_name,
       phone = excluded.phone,
       role = excluded.role,
       updated_at = excluded.updated_at`,
    [
      row.id,
      row.full_name,
      row.phone,
      row.role,
      row.created_at,
      row.updated_at,
    ]
  );
  ok++;
}

const admins = await client.query(
  `select full_name, role from public.profiles where role = 'admin'`
);
console.log("upserted", ok, "admins", admins.rows);
await client.end();
