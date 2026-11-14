require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./database/db');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET = process.env.JWT_SECRET || 'chave_secreta_padrao';

function verificarToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Acesso negado.' });
  jwt.verify(token, JWT_SECRET, (err, decod) => {
    if (err) return res.status(403).json({ error: 'Token inválido.' });
    req.usuario = decod;
    next();
  });
}

function permitirPerfis(...perfis) {
  return (req, res, next) => {
    if (!req.usuario || !perfis.includes(req.usuario.perfil)) {
      return res.status(403).json({ error: 'Permissão insuficiente para esta ação.' });
    }
    next();
  };
}

function gerarEmail(nome) {
  const formatado = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .split(/\s+/)[0];
  return `${formatado}${Math.floor(Math.random() * 1000)}@petcare.com.br`;
}

// =====================================
// SETUP INICIAL (PRIMEIRO MASTER)
// =====================================
app.get('/api/setup/status', (req, res) => {
  db.query("SELECT COUNT(*) AS total FROM usuarios WHERE perfil = 'MASTER'", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ needsSetup: rows[0].total === 0 });
  });
});

app.post('/api/setup', (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha || senha.length < 6) {
    return res.status(400).json({ error: 'Informe nome, e-mail e uma senha com pelo menos 6 caracteres.' });
  }

  db.query("SELECT COUNT(*) AS total FROM usuarios WHERE perfil = 'MASTER'", async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (rows[0].total > 0) {
      return res.status(403).json({ error: 'O sistema já possui um administrador configurado.' });
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    db.query(
      "INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, 'MASTER')",
      [nome, email, senhaHash],
      (insertErr) => {
        if (insertErr) return res.status(400).json({ error: 'Erro ao criar administrador. E-mail pode já estar em uso.' });
        res.status(201).json({ success: true, message: 'Administrador configurado com sucesso!' });
      }
    );
  });
});

// =====================================
// AUTENTICAÇÃO (LOGIN)
// =====================================
app.post('/api/login', (req, res) => {
  const { usuario, senha } = req.body;
  if (!usuario || !senha) {
    return res.status(400).json({ message: 'Informe e-mail e senha.' });
  }

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
  if (!nome || !cpf || !telefone || !email) {
    return res.status(400).json({ error: 'Preencha nome, CPF, telefone e e-mail.' });
  }

  db.query('SELECT id FROM usuarios WHERE email = ?', [email], (err, usrs) => {
    if (err) return res.status(500).json({ error: 'Erro ao verificar e-mail.' });
    if (usrs.length > 0) return res.status(400).json({ error: 'E-mail já cadastrado!' });

    db.query(
      'INSERT INTO tutores (nome, cpf, telefone, email, endereco) VALUES (?, ?, ?, ?, ?)',
      [nome, cpf, telefone, email, endereco || null],
      async (err, result) => {
        if (err) return res.status(400).json({ error: 'Erro ao cadastrar tutor. Verifique se CPF ou e-mail já existem.' });
        const tutorId = result.insertId;
        const senhaHash = await bcrypt.hash(cpf, 10);

        db.query(
          "INSERT INTO usuarios (tutor_id, nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?, 'TUTOR')",
          [tutorId, nome, email, senhaHash],
          (err) => {
            if (err) return res.status(500).json({ error: 'Erro ao gerar usuário.' });
            res.status(201).json({ success: true, id: tutorId, message: 'Cadastro realizado com sucesso!' });
          }
        );
      }
    );
  });
});

app.get('/api/tutores', verificarToken, permitirPerfis('MASTER', 'RECEPCIONISTA', 'VETERINARIO'), (req, res) => {
  db.query('SELECT * FROM tutores ORDER BY nome ASC', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.put('/api/tutores/:id', verificarToken, permitirPerfis('MASTER', 'RECEPCIONISTA'), (req, res) => {
  const { nome, telefone, email, endereco } = req.body;
  db.query(
    'UPDATE tutores SET nome = ?, telefone = ?, email = ?, endereco = ? WHERE id = ?',
    [nome, telefone, email, endereco || null, req.params.id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Tutor não encontrado.' });

      db.query(
        'UPDATE usuarios SET nome = ?, email = ? WHERE tutor_id = ?',
        [nome, email, req.params.id],
        () => {
          res.json({ success: true, message: 'Tutor atualizado!' });
        }
      );
    }
  );
});

app.delete('/api/tutores/:id', verificarToken, permitirPerfis('MASTER'), (req, res) => {
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

app.post('/api/veterinarios', verificarToken, permitirPerfis('MASTER'), (req, res) => {
  const { nome, cpf, crmv, especialidade } = req.body;
  if (!nome || !cpf || !crmv || !especialidade) {
    return res.status(400).json({ error: 'Preencha todos os campos do veterinário.' });
  }

  db.query(
    'INSERT INTO veterinarios (nome, cpf, crmv, especialidade) VALUES (?, ?, ?, ?)',
    [nome, cpf, crmv, especialidade],
    async (err, result) => {
      if (err) return res.status(400).json({ error: 'Erro ao cadastrar veterinário. Verifique CPF/CRMV.' });
      const vetId = result.insertId;
      const email = gerarEmail(nome);
      const senhaHash = await bcrypt.hash(cpf, 10);

      db.query(
        "INSERT INTO usuarios (veterinario_id, nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?, 'VETERINARIO')",
        [vetId, nome, email, senhaHash],
        (err) => {
          if (err) return res.status(500).json({ error: 'Veterinário salvo, mas erro ao gerar login.' });
          res.status(201).json({ message: 'Veterinário criado!', email: email, senha: cpf });
        }
      );
    }
  );
});

app.put('/api/veterinarios/:id', verificarToken, permitirPerfis('MASTER'), (req, res) => {
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

app.delete('/api/veterinarios/:id', verificarToken, permitirPerfis('MASTER'), (req, res) => {
  db.query('DELETE FROM veterinarios WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(400).json({ error: 'Não é possível remover veterinário vinculado a consultas.' });
    res.json({ message: 'Veterinário removido!' });
  });
});

// =====================================
// USUÁRIOS (RECEPCIONISTAS / ADMINS)
// =====================================
app.get('/api/usuarios', verificarToken, permitirPerfis('MASTER'), (req, res) => {
  db.query(
    'SELECT id, veterinario_id, tutor_id, nome, email, perfil, ativo FROM usuarios ORDER BY id DESC',
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

app.post('/api/usuarios', verificarToken, permitirPerfis('MASTER'), async (req, res) => {
  const { nome, email, senha, perfil } = req.body;
  if (!nome || !email || !senha) {
    return res.status(400).json({ error: 'Informe nome, e-mail e senha.' });
  }
  const senhaHash = await bcrypt.hash(senha, 10);
  db.query(
    'INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)',
    [nome, email, senhaHash, perfil || 'RECEPCIONISTA'],
    (err) => {
      if (err) return res.status(400).json({ error: 'Erro ao criar usuário. E-mail pode já estar em uso.' });
      res.status(201).json({ success: true, message: 'Usuário criado!' });
    }
  );
});

app.put('/api/usuarios/:id', verificarToken, permitirPerfis('MASTER'), (req, res) => {
  const { ativo, perfil, nome } = req.body;
  db.query(
    'UPDATE usuarios SET ativo = COALESCE(?, ativo), perfil = COALESCE(?, perfil), nome = COALESCE(?, nome) WHERE id = ?',
    [ativo !== undefined ? (ativo ? 1 : 0) : null, perfil || null, nome || null, req.params.id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
      res.json({ success: true });
    }
  );
});

app.delete('/api/usuarios/:id', verificarToken, permitirPerfis('MASTER'), (req, res) => {
  if (Number(req.params.id) === req.usuario.id) {
    return res.status(400).json({ error: 'Você não pode excluir seu próprio usuário.' });
  }
  db.query('DELETE FROM usuarios WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Usuário removido!' });
  });
});

// =====================================
// PETS (CRUD COMPLETO)
// =====================================
app.get('/api/pets', verificarToken, permitirPerfis('MASTER', 'RECEPCIONISTA', 'VETERINARIO'), (req, res) => {
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
  if (req.usuario.perfil === 'TUTOR' && Number(req.params.tutor_id) !== req.usuario.tutor_id) {
    return res.status(403).json({ error: 'Acesso negado aos pets de outro tutor.' });
  }
  db.query('SELECT * FROM pets WHERE tutor_id = ? ORDER BY nome ASC', [req.params.tutor_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/api/pets', verificarToken, (req, res) => {
  const { tutor_id, nome, microchip, especie, raca, sexo, data_nascimento, peso_kg } = req.body;
  const effectiveTutorId = req.usuario.perfil === 'TUTOR' ? req.usuario.tutor_id : tutor_id;
  if (!effectiveTutorId || !nome || !especie || !sexo) {
    return res.status(400).json({ error: 'Preencha tutor, nome, espécie e sexo do pet.' });
  }

  db.query(
    'INSERT INTO pets (tutor_id, nome, microchip, especie, raca, sexo, data_nascimento, peso_kg) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      effectiveTutorId,
      nome,
      microchip || null,
      especie,
      raca || 'SRD',
      sexo,
      data_nascimento || null,
      peso_kg || 0.00
    ],
    (err, result) => {
      if (err) return res.status(400).json({ error: err.message });
      res.status(201).json({ success: true, id: result.insertId });
    }
  );
});

app.put('/api/pets/:id', verificarToken, (req, res) => {
  const { nome, microchip, especie, raca, sexo, data_nascimento, peso_kg } = req.body;
  const doUpdate = () => {
    db.query(
      'UPDATE pets SET nome = ?, microchip = ?, especie = ?, raca = ?, sexo = ?, data_nascimento = ?, peso_kg = ? WHERE id = ?',
      [nome, microchip || null, especie, raca || 'SRD', sexo, data_nascimento || null, peso_kg || 0.00, req.params.id],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Dados do pet atualizados!' });
      }
    );
  };

  if (req.usuario.perfil === 'TUTOR') {
    db.query('SELECT tutor_id FROM pets WHERE id = ?', [req.params.id], (err, rows) => {
      if (err || rows.length === 0) return res.status(404).json({ error: 'Pet não encontrado.' });
      if (rows[0].tutor_id !== req.usuario.tutor_id) return res.status(403).json({ error: 'Permissão negada.' });
      doUpdate();
    });
  } else {
    doUpdate();
  }
});

app.delete('/api/pets/:id', verificarToken, (req, res) => {
  const doDelete = () => {
    db.query('DELETE FROM pets WHERE id = ?', [req.params.id], (err) => {
      if (err) return res.status(400).json({ error: 'Erro ao remover pet. Pode estar vinculado a histórico de consultas.' });
      res.json({ message: 'Removido com sucesso!' });
    });
  };

  if (req.usuario.perfil === 'TUTOR') {
    db.query('SELECT tutor_id FROM pets WHERE id = ?', [req.params.id], (err, rows) => {
      if (err || rows.length === 0) return res.status(404).json({ error: 'Pet não encontrado.' });
      if (rows[0].tutor_id !== req.usuario.tutor_id) return res.status(403).json({ error: 'Permissão negada.' });
      doDelete();
    });
  } else {
    doDelete();
  }
});

// =====================================
// CONSULTAS / ATENDIMENTOS
// =====================================
app.get('/api/consultas', verificarToken, permitirPerfis('MASTER', 'RECEPCIONISTA', 'VETERINARIO'), (req, res) => {
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
  if (req.usuario.perfil === 'TUTOR' && Number(req.params.tutor_id) !== req.usuario.tutor_id) {
    return res.status(403).json({ error: 'Acesso negado.' });
  }
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

app.get('/api/consultas/veterinario/:veterinario_id', verificarToken, permitirPerfis('MASTER', 'VETERINARIO', 'RECEPCIONISTA'), (req, res) => {
  const query = `
    SELECT c.*, p.nome AS pet_nome, p.especie, p.peso_kg, t.nome AS tutor_nome, t.telefone AS tutor_telefone
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
  if (!pet_id || !veterinario_id || !data_consulta) {
    return res.status(400).json({ error: 'Informe pet, veterinário e data da consulta.' });
  }

  const doInsert = () => {
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
        if (err) return res.status(400).json({ error: err.message });
        res.status(201).json({ success: true, id: result.insertId });
      }
    );
  };

  if (req.usuario.perfil === 'TUTOR') {
    db.query('SELECT tutor_id FROM pets WHERE id = ?', [pet_id], (err, rows) => {
      if (err || rows.length === 0) return res.status(404).json({ error: 'Pet não encontrado.' });
      if (rows[0].tutor_id !== req.usuario.tutor_id) {
        return res.status(403).json({ error: 'Você só pode agendar consultas para os seus próprios pets.' });
      }
      doInsert();
    });
  } else {
    doInsert();
  }
});

app.put('/api/consultas/:id/processar', verificarToken, (req, res) => {
  const { status, observacoes, valor } = req.body;
  if (!status) return res.status(400).json({ error: 'Status é obrigatório.' });

  const doUpdate = () => {
    db.query(
      'UPDATE consultas SET status = ?, observacoes = COALESCE(?, observacoes), valor = COALESCE(?, valor) WHERE id = ?',
      [status, observacoes !== undefined ? observacoes : null, valor !== undefined ? valor : null, req.params.id],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Consulta não encontrada.' });
        res.json({ success: true });
      }
    );
  };

  if (req.usuario.perfil === 'TUTOR') {
    if (status !== 'CANCELADA') {
      return res.status(403).json({ error: 'Tutores só podem cancelar consultas.' });
    }
    db.query(
      'SELECT p.tutor_id FROM consultas c JOIN pets p ON c.pet_id = p.id WHERE c.id = ?',
      [req.params.id],
      (err, rows) => {
        if (err || rows.length === 0) return res.status(404).json({ error: 'Consulta não encontrada.' });
        if (rows[0].tutor_id !== req.usuario.tutor_id) return res.status(403).json({ error: 'Permissão negada.' });
        doUpdate();
      }
    );
  } else {
    doUpdate();
  }
});

app.delete('/api/consultas/:id', verificarToken, permitirPerfis('MASTER', 'RECEPCIONISTA'), (req, res) => {
  db.query('DELETE FROM consultas WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Consulta excluída!' });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PetCare API rodando na porta ${PORT}`));
