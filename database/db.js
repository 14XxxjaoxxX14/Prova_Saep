const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.resolve(
  process.cwd(),
  process.env.DB_PATH || './database/petcare.sqlite'
);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new DatabaseSync(dbPath);
sqlite.exec('PRAGMA foreign_keys = ON;');
sqlite.exec('PRAGMA journal_mode = WAL;');

let initialized = false;

/**
 * Inicializa o schema SQLite e cria o usuário MASTER padrão na primeira execução.
 */
function initDb() {
  if (initialized) return;

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS veterinarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cpf TEXT NOT NULL UNIQUE,
      crmv TEXT NOT NULL UNIQUE,
      especialidade TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'INATIVO')),
      criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tutores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cpf TEXT NOT NULL UNIQUE,
      telefone TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      endereco TEXT NULL,
      criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      veterinario_id INTEGER NULL,
      tutor_id INTEGER NULL,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      perfil TEXT NOT NULL DEFAULT 'RECEPCIONISTA' CHECK (perfil IN ('MASTER', 'VETERINARIO', 'RECEPCIONISTA', 'TUTOR')),
      ativo INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (veterinario_id) REFERENCES veterinarios (id) ON DELETE CASCADE,
      FOREIGN KEY (tutor_id) REFERENCES tutores (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tutor_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      microchip TEXT NULL UNIQUE,
      especie TEXT NOT NULL CHECK (especie IN ('CAO', 'GATO', 'AVE', 'ROEDOR', 'OUTRO')),
      raca TEXT NOT NULL DEFAULT 'SRD',
      sexo TEXT NOT NULL CHECK (sexo IN ('M', 'F')),
      data_nascimento TEXT NULL,
      peso_kg REAL NOT NULL DEFAULT 0.00,
      criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tutor_id) REFERENCES tutores (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS consultas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pet_id INTEGER NOT NULL,
      veterinario_id INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL,
      data_consulta TEXT NOT NULL,
      tipo_atendimento TEXT NOT NULL DEFAULT 'CONSULTA' CHECK (tipo_atendimento IN ('CONSULTA', 'VACINA', 'EXAME', 'CIRURGIA', 'RETORNO')),
      status TEXT NOT NULL DEFAULT 'AGENDADA' CHECK (status IN ('AGENDADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA')),
      observacoes TEXT NULL,
      valor REAL NOT NULL DEFAULT 0.00,
      criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pet_id) REFERENCES pets (id) ON DELETE CASCADE,
      FOREIGN KEY (veterinario_id) REFERENCES veterinarios (id) ON DELETE RESTRICT,
      FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
    );
  `);

  const row = sqlite.prepare("SELECT COUNT(*) AS total FROM usuarios WHERE perfil = 'MASTER'").get();
  if (row.total === 0) {
    const adminName = process.env.ADMIN_NAME || 'Administrador';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@petcare.com.br';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin1234';

    const senhaHash = bcrypt.hashSync(adminPassword, 10);
    sqlite
      .prepare('INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)')
      .run(adminName, adminEmail, senhaHash, 'MASTER');
    console.log(`[SQLite] Banco auto-configurado em: ${dbPath}`);
    console.log(`[SQLite] Usuário MASTER padrão criado: ${adminEmail}`);
  } else {
    console.log(`[SQLite] Conectado em: ${dbPath}`);
  }

  initialized = true;
}

function normalizeParam(value) {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

/**
 * Executa queries SQL com interface compatível com callbacks estilo mysql2.
 */
function query(sql, params, callback) {
  let bindParams = params;
  let cb = callback;

  if (typeof params === 'function') {
    cb = params;
    bindParams = [];
  }

  const normalized = Array.isArray(bindParams) ? bindParams.map(normalizeParam) : [];

  try {
    const stmt = sqlite.prepare(sql);
    if (/^\s*(SELECT|PRAGMA|WITH)\b/i.test(sql)) {
      const rows = stmt.all(...normalized);
      if (cb) cb(null, rows);
      return rows;
    }

    const info = stmt.run(...normalized);
    const result = {
      insertId: Number(info.lastInsertRowid),
      affectedRows: info.changes
    };
    if (cb) cb(null, result);
    return result;
  } catch (err) {
    if (cb) cb(err);
    else throw err;
  }
}

initDb();

module.exports = {
  dbPath,
  initDb,
  query,
  sqlite
};
