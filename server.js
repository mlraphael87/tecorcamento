const express = require("express");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3333;
const appUser = process.env.APP_USER || "admin";
const appPassword = process.env.APP_PASSWORD || "orcamento";
const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "orcamentos.sqlite");
const usePostgres = Boolean(process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL);

fs.mkdirSync(dataDir, { recursive: true });
const sqliteDb = usePostgres ? null : new sqlite3.Database(dbPath);
const pgPool = usePostgres
  ? new Pool({
      connectionString: process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL,
      ssl: process.env.POSTGRES_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
    })
  : null;

function toPgSql(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

async function initDb() {
  if (usePostgres) {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS orcamentos (
        id SERIAL PRIMARY KEY,
        os_numero INTEGER NOT NULL UNIQUE,
        data TEXT NOT NULL,
        paciente TEXT NOT NULL,
        cpf TEXT,
        contato TEXT,
        origem TEXT,
        nascimento TEXT,
        concessao TEXT,
        fabricante TEXT,
        modelo TEXT,
        serie TEXT,
        servico TEXT,
        pecas TEXT,
        valor_total DOUBLE PRECISION NOT NULL DEFAULT 0,
        valor_extenso TEXT,
        observacao TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        fabricante2 TEXT,
        modelo2 TEXT,
        serie2 TEXT,
        observacao2 TEXT
      )
    `);
    for (const column of ["fabricante2 TEXT", "modelo2 TEXT", "serie2 TEXT", "observacao2 TEXT"]) {
      await pgPool.query(`ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS ${column}`);
    }
    return;
  }

  sqliteDb.serialize(() => {
    sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS orcamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      os_numero INTEGER NOT NULL UNIQUE,
      data TEXT NOT NULL,
      paciente TEXT NOT NULL,
      cpf TEXT,
      contato TEXT,
      origem TEXT,
      nascimento TEXT,
      concessao TEXT,
      fabricante TEXT,
      modelo TEXT,
      serie TEXT,
      servico TEXT,
      pecas TEXT,
      valor_total REAL NOT NULL DEFAULT 0,
      valor_extenso TEXT,
      observacao TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

    for (const column of ["fabricante2 TEXT", "modelo2 TEXT", "serie2 TEXT", "observacao2 TEXT"]) {
      sqliteDb.run(`ALTER TABLE orcamentos ADD COLUMN ${column}`, (error) => {
      if (error && !String(error.message).includes("duplicate column name")) {
        console.error(error);
      }
      });
    }
  }
  );
}

app.use(express.json({ limit: "1mb" }));

app.use((request, response, next) => {
  const header = request.headers.authorization || "";
  const [type, token] = header.split(" ");
  const credentials = token ? Buffer.from(token, "base64").toString("utf8") : "";
  const separator = credentials.indexOf(":");
  const user = separator >= 0 ? credentials.slice(0, separator) : "";
  const password = separator >= 0 ? credentials.slice(separator + 1) : "";

  if (type === "Basic" && user === appUser && password === appPassword) {
    return next();
  }

  response.set("WWW-Authenticate", 'Basic realm="Orcamentos TEC"');
  return response.status(401).send("Acesso restrito.");
});

app.use(async (_request, _response, next) => {
  try {
    await dbReady;
    next();
  } catch (error) {
    next(error);
  }
});

app.use(express.static(path.join(__dirname, "public")));

function run(sql, params = []) {
  if (usePostgres) {
    return pgPool.query(toPgSql(sql), params).then((result) => ({ lastID: result.rows[0]?.id }));
  }
  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  if (usePostgres) {
    return pgPool.query(toPgSql(sql), params).then((result) => result.rows[0]);
  }
  return new Promise((resolve, reject) => {
    sqliteDb.get(sql, params, (error, row) => (error ? reject(error) : resolve(row)));
  });
}

function all(sql, params = []) {
  if (usePostgres) {
    return pgPool.query(toPgSql(sql), params).then((result) => result.rows);
  }
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (error, rows) => (error ? reject(error) : resolve(rows)));
  });
}

async function nextOsNumero() {
  const row = await get("SELECT COALESCE(MAX(os_numero), 125) + 1 AS next FROM orcamentos");
  return row.next;
}

function normalizeMoney(value) {
  if (typeof value === "string") {
    value = value.replace(/\./g, "").replace(",", ".");
  }
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}

function parseDate(value) {
  return value ? String(value).slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validatePayload(payload) {
  const errors = [];
  if (!clean(payload.paciente)) errors.push("Informe o paciente.");
  if (!clean(payload.fabricante)) errors.push("Informe o fabricante.");
  if (!clean(payload.modelo)) errors.push("Informe o modelo.");
  if (!clean(payload.serie)) errors.push("Informe o numero de serie.");
  if ((clean(payload.fabricante2) || clean(payload.modelo2) || clean(payload.serie2)) && !clean(payload.serie2)) {
    errors.push("Informe o numero de serie do aparelho 2.");
  }
  if (!clean(payload.servico)) errors.push("Informe o servico.");
  if (normalizeMoney(payload.valor_total) <= 0) errors.push("Informe um custo total maior que zero.");
  return errors;
}

app.get("/api/next-os", async (_request, response, next) => {
  try {
    response.json({ next: await nextOsNumero() });
  } catch (error) {
    next(error);
  }
});

app.get("/api/orcamentos", async (request, response, next) => {
  try {
    const q = `%${clean(request.query.q)}%`;
    const rows = await all(
      `
        SELECT *
        FROM orcamentos
        WHERE ? = '%%'
          OR paciente LIKE ?
          OR origem LIKE ?
          OR fabricante LIKE ?
          OR fabricante2 LIKE ?
          OR modelo LIKE ?
          OR modelo2 LIKE ?
          OR serie LIKE ?
          OR serie2 LIKE ?
          OR ${usePostgres ? "LPAD(os_numero::text, 4, '0')" : "printf('%04d', os_numero)"} LIKE ?
        ORDER BY os_numero DESC
        LIMIT 200
      `,
      [q, q, q, q, q, q, q, q, q, q]
    );
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/orcamentos/:id", async (request, response, next) => {
  try {
    const row = await get("SELECT * FROM orcamentos WHERE id = ?", [request.params.id]);
    if (!row) return response.status(404).json({ error: "Orcamento nao encontrado." });
    response.json(row);
  } catch (error) {
    next(error);
  }
});

app.post("/api/orcamentos", async (request, response, next) => {
  try {
    const payload = request.body || {};
    const errors = validatePayload(payload);
    if (errors.length) return response.status(400).json({ errors });

    const osNumero = payload.os_numero ? Number(payload.os_numero) : await nextOsNumero();
    const result = await run(
      `
        INSERT INTO orcamentos (
          os_numero, data, paciente, cpf, contato, origem, nascimento, concessao,
          fabricante, modelo, serie, fabricante2, modelo2, serie2, servico, pecas,
          valor_total, valor_extenso, observacao, observacao2
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ${usePostgres ? "RETURNING id" : ""}
      `,
      [
        osNumero,
        parseDate(payload.data),
        clean(payload.paciente).toUpperCase(),
        clean(payload.cpf),
        clean(payload.contato),
        clean(payload.origem).toUpperCase(),
        payload.nascimento ? parseDate(payload.nascimento) : "",
        payload.concessao ? parseDate(payload.concessao) : "",
        clean(payload.fabricante).toUpperCase(),
        clean(payload.modelo).toUpperCase(),
        clean(payload.serie).toUpperCase(),
        clean(payload.fabricante2).toUpperCase(),
        clean(payload.modelo2).toUpperCase(),
        clean(payload.serie2).toUpperCase(),
        clean(payload.servico).toUpperCase(),
        clean(payload.pecas).toUpperCase(),
        normalizeMoney(payload.valor_total),
        clean(payload.valor_extenso).toUpperCase(),
        clean(payload.observacao).toUpperCase(),
        clean(payload.observacao2).toUpperCase(),
      ]
    );

    const row = await get("SELECT * FROM orcamentos WHERE id = ?", [result.lastID]);
    response.status(201).json(row);
  } catch (error) {
    if (error && error.code === "SQLITE_CONSTRAINT") {
      return response.status(409).json({ errors: ["Este numero de OS ja existe."] });
    }
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: "Erro interno ao processar a solicitacao." });
});

const dbReady = initDb().catch((error) => {
  console.error("Erro ao iniciar banco de dados", error);
  throw error;
});

if (require.main === module) {
  dbReady.then(() => {
    app.listen(port, () => {
      console.log(`Aplicacao de orcamentos rodando em http://localhost:${port}`);
      console.log(`Banco de dados: ${usePostgres ? "PostgreSQL" : dbPath}`);
      console.log(`Usuario: ${appUser}`);
    });
  });
}

module.exports = app;
