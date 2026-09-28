import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const url = process.env.EXTERNAL_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("Set EXTERNAL_DATABASE_URL or DATABASE_URL before backing up.");

const outputArg = process.argv.find(arg => arg.startsWith("--output="));
const schemaOnly = process.argv.includes("--schema-only");
const output = outputArg?.slice("--output=".length) ?? `backups/extintores-${new Date().toISOString().replaceAll(/[:.]/g, "-")}.json`;

const connection = await mysql.createConnection({
  uri: url,
  ssl: { rejectUnauthorized: true },
});
try {
  const [tableRows] = await connection.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const tableNames = tableRows.map(row => Object.values(row)[0]).filter(name => name !== "__drizzle_migrations");
  const tables = [];
  for (const tableName of tableNames) {
    const [[definition]] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
    const createSql = definition["Create Table"];
    const [rows] = schemaOnly ? [[], []] : await connection.query(`SELECT * FROM \`${tableName}\``);
    tables.push({ name: tableName, createSql, rows });
  }
  const backup = { format: 1, generatedAt: new Date().toISOString(), database: "mysql-compatible", schemaOnly, tables };
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(backup, null, 2), { mode: 0o600 });
  console.log(`Backup written to ${output} (${tables.length} tables${schemaOnly ? ", schema only" : " with data"}).`);
} finally {
  await connection.end();
}
