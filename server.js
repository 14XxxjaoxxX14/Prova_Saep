DB_NAME=petcare_db

require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');


const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


const JWT_SECRET = process.env.JWT_SECRET || 'chave_secreta_padrao';


const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'petcare_db'
});


function verificarToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Acesso negado.' });
  jwt.verify(token, JWT_SECRET, (err, decod) => {
    if (err) return res.status(403).json({ error: 'Token inválido.' });
    req.usuario = decod;
    next();
  });
}


function gerarEmail(nome) {
  const formatado = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(" ")[0];
  return ${formatado}${Math.floor(Math.random() * 1000)}@petcare.com.br;
}


// =====================================
// AUTENTICAÇÃO (LOGIN)
// =====================================
app.post('/api/login', (req, res) => {
  const { usuario, senha } = req.body;
  db.query('SELECT * FROM usuarios WHERE email = ? AND ativo = 1', [usuario], async (err, results) => {
    if (err) return res.status(500).json({ message: 'Erro no servidor.' });
    if (results.length === 0 || !(await bcrypt.compare(senha, results[0].senha_hash))) {
      return res.status(401).json({ message: 'Credenciais inválidas!' });
    }
    const user = results[0];
    const token = jwt.sign(
      {
        id: user.id,
        perfil: user.perfil,
        veterinario_id: user.veterinario_id,
        tutor_id: user.tutor_id
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        perfil: user.perfil,
        veterinario_id: user.veterinario_id,
        tutor_id: user.tutor_id
      }
    });
  });
});


// =====================================
// TUTORES (AUTO-CADASTRO E CRUD)
// =====================================
app.post('/api/tutores/cadastro', (req, res) => {
  const { nome, cpf, telefone, email, endereco } = req.body;
  db.query('SELECT id FROM usuarios WHERE email = ?', [email], (err, usrs) => {
    if (err) return res.status(500).json({ error: 'Erro ao verificar e-mail.' });
    if (usrs.length > 0) return res.status(400).json({ error: 'E-mail já cadastrado!' });


    db.query(
      'INSERT INTO tutores (nome, cpf, telefone, email, endereco) VALUES (?, ?, ?, ?, ?)',
      [nome, cpf, telefone, email, endereco || null],
      async (err, result) => {
        if (err) return res.status(500).json({ error: 'Erro ao cadastrar tutor. Verifique o CPF.' });
        const tutorId = result.insertId;
        const senhaHash = await bcrypt.hash(cpf, 10);


        db.query(
          'INSERT INTO usuarios (tutor_id, nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?, "TUTOR")',
          [tutorId, nome, email, senhaHash],
          (err) => {
            if (err) return res.status(500).json({ error: 'Erro ao gerar usuário.' });
            res.status(201).json({ success: true, message: 'Cadastro realizado com sucesso!' });
          }
        );
      }
    );
  });
});


app.get('/api/tutores', verificarToken, (req, res) => {
  db.query('SELECT * FROM tutores ORDER BY nome ASC', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});


app.put('/api/tutores/:id', verificarToken, (req, res) => {
  const { nome, telefone, email, endereco } = req.body;
  db.query(
    'UPDATE tutores SET nome = ?, telefone = ?, email = ?, endereco = ? WHERE id = ?',
    [nome, telefone, email, endereco || null, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, message: 'Tutor atualizado!' });
    }
  );
});


app.delete('/api/tutores/:id', verificarToken, (req, res) => {
  db.query('DELETE FROM tutores WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Tutor removido!' });
  });
});


// =====================================
// VETERINÁRIOS / EQUIPE TÉCNICA
// =====================================
app.get('/api/veterinarios', verificarToken, (req, res) => {
  db.query('SELECT * FROM veterinarios ORDER BY nome ASC', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});


app.post('/api/veterinarios', verificarToken, (req, res) => {
  const { nome, cpf, crmv, especialidade } = req.body;
  db.query(
    'INSERT INTO veterinarios (nome, cpf, crmv, especialidade) VALUES (?, ?, ?, ?)',
    [nome, cpf, crmv, especialidade],
    async (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      const vetId = result.insertId;
      const email = gerarEmail(nome);
      const senhaHash = await bcrypt.hash(cpf, 10);


      db.query(
        'INSERT INTO usuarios (veterinario_id, nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?, "VETERINARIO")',
        [vetId, nome, email, senhaHash],
        (err) => {
          if (err) return res.status(500).json({ error: 'Veterinário salvo, mas erro ao gerar login.' });
          res.status(201).json({ message: 'Veterinário criado!', email: email, senha: cpf });
        }
      );
    }
  );
});


app.put('/api/veterinarios/:id', verificarToken, (req, res) => {
  const { nome, crmv, especialidade, status } = req.body;
  db.query(
    'UPDATE veterinarios SET nome = ?, crmv = ?, especialidade = ?, status = ? WHERE id = ?',
    [nome, crmv, especialidade, status || 'ATIVO', req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, message: 'Veterinário atualizado!' });
    }
  );
});


app.delete('/api/veterinarios/:id', verificarToken, (req, res) => {
  db.query('DELETE FROM veterinarios WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(400).json({ error: 'Não é possível remover veterinário vinculado a consultas.' });
    res.json({ message: 'Veterinário removido!' });
  });
});


// =====================================
// USUÁRIOS (RECEPCIONISTAS / ADMINS)
// =====================================
app.get('/api/usuarios', verificarToken, (req, res) => {
  db.query('SELECT id, veterinario_id, tutor_id, nome, email, perfil, ativo FROM usuarios ORDER BY id DESC', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});


app.post('/api/usuarios', verificarToken, async (req, res) => {
  const { nome, email, senha, perfil } = req.body;
  const senhaHash = await bcrypt.hash(senha, 10);
  db.query(
    'INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)',
    [nome, email, senhaHash, perfil || 'RECEPCIONISTA'],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ success: true, message: 'Usuário criado!' });
    }
  );
});


// =====================================
// PETS (CRUD COMPLETO)
// =====================================
app.get('/api/pets', verificarToken, (req, res) => {
  const query = `
    SELECT p.*, t.nome AS tutor_nome, t.telefone AS tutor_telefone 
    FROM pets p 
    JOIN tutores t ON p.tutor_id = t.id 
    ORDER BY p.id DESC`;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});


app.get('/api/pets/tutor/:tutor_id', verificarToken, (req, res) => {
  db.query('SELECT * FROM pets WHERE tutor_id = ? ORDER BY nome ASC', [req.params.tutor_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});


app.post('/api/pets', verificarToken, (req, res) => {
  const { tutor_id, nome, microchip, especie, raca, sexo, data_nascimento, peso_kg } = req.body;
  db.query(
    'INSERT INTO pets (tutor_id, nome, microchip, especie, raca, sexo, data_nascimento, peso_kg) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      tutor_id,
      nome,
      microchip || null,
      especie,
      raca || 'SRD',
      sexo,
      data_nascimento || null,
      peso_kg || 0.00
    ],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ success: true, id: result.insertId });
    }
  );
});


app.put('/api/pets/:id', verificarToken, (req, res) => {
  const { nome, microchip, especie, raca, sexo, data_nascimento, peso_kg } = req.body;
  db.query(
    'UPDATE pets SET nome = ?, microchip = ?, especie = ?, raca = ?, sexo = ?, data_nascimento = ?, peso_kg = ? WHERE id = ?',
    [nome, microchip || null, especie, raca || 'SRD', sexo, data_nascimento || null, peso_kg || 0.00, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, message: 'Dados do pet atualizados!' });
    }
  );
});


app.delete('/api/pets/:id', verificarToken, (req, res) => {
  db.query('DELETE FROM pets WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(400).json({ error: 'Erro ao remover pet. Pode estar vinculado a histórico de consultas.' });
    res.json({ message: 'Removido com sucesso!' });
  });
});


// =====================================
// CONSULTAS / ATENDIMENTOS
// =====================================
app.get('/api/consultas', verificarToken, (req, res) => {
  const query = `
    SELECT c.*, 
           p.nome AS pet_nome, p.especie, p.raca,
           t.nome AS tutor_nome, t.telefone AS tutor_telefone,
           v.nome AS veterinario_nome, v.crmv,
           u.nome AS registrado_por
    FROM consultas c
    JOIN pets p ON c.pet_id = p.id
    JOIN tutores t ON p.tutor_id = t.id
    JOIN veterinarios v ON c.veterinario_id = v.id
    JOIN usuarios u ON c.usuario_id = u.id
    ORDER BY c.data_consulta DESC`;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});


app.get('/api/consultas/tutor/:tutor_id', verificarToken, (req, res) => {
  const query = `
    SELECT c.*, p.nome AS pet_nome, v.nome AS veterinario_nome, v.especialidade
    FROM consultas c
    JOIN pets p ON c.pet_id = p.id
    JOIN veterinarios v ON c.veterinario_id = v.id
    WHERE p.tutor_id = ?
    ORDER BY c.data_consulta DESC`;
  db.query(query, [req.params.tutor_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});


app.get('/api/consultas/veterinario/:veterinario_id', verificarToken, (req, res) => {
  const query = `
    SELECT c.*, p.nome AS pet_nome, p.especie, p.peso_kg, t.nome AS tutor_nome
    FROM consultas c
    JOIN pets p ON c.pet_id = p.id
    JOIN tutores t ON p.tutor_id = t.id
    WHERE c.veterinario_id = ?
    ORDER BY c.data_consulta ASC`;
  db.query(query, [req.params.veterinario_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});


app.post('/api/consultas', verificarToken, (req, res) => {
  const { pet_id, veterinario_id, usuario_id, data_consulta, tipo_atendimento, observacoes, valor } = req.body;
  db.query(
    'INSERT INTO consultas (pet_id, veterinario_id, usuario_id, data_consulta, tipo_atendimento, observacoes, valor) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      pet_id,
      veterinario_id,
      usuario_id || req.usuario.id,
      data_consulta,
      tipo_atendimento || 'CONSULTA',
      observacoes || null,
      valor || 0.00
    ],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ success: true, id: result.insertId });
    }
  );
});


app.put('/api/consultas/:id/processar', verificarToken, (req, res) => {
  const { status, observacoes, valor } = req.body;
  db.query(
    'UPDATE consultas SET status = ?, observacoes = COALESCE(?, observacoes), valor = COALESCE(?, valor) WHERE id = ?',
    [status, observacoes, valor, req.params.id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Consulta não encontrada.' });
      res.json({ success: true });
    }
  );
});


app.delete('/api/consultas/:id', verificarToken, (req, res) => {
  db.query('DELETE FROM consultas WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Consulta excluída!' });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(PetCare API rodando na porta ${PORT}))