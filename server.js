require('dotenv').config(); 
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); 

const app = express();
app.use(cors()); app.use(express.json()); 
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET = process.env.JWT_SECRET || 'chave_secreta_padrao';

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost', user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'sgmc_db'
});

function verificarToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Acesso negado.' });
  jwt.verify(token, JWT_SECRET, (err, decod) => {
    if (err) return res.status(403).json({ error: 'Token inválido.' });
    req.usuario = decod; next();
  });
}

function gerarEmail(nome) {
  const formatado = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(" ")[0];
  return `${formatado}${Math.floor(Math.random()*1000)}@sgmc.com.br`;
}

// =====================================
// JOB DE EXPIRAÇÃO DE RESERVAS (24h)
// =====================================
setInterval(() => {
  const query = "SELECT id, material_id, quantidade FROM reservas WHERE status = 'ATIVA' AND data_reserva < NOW() - INTERVAL 24 HOUR";
  db.query(query, (err, expiradas) => {
    if (err) return console.error('Erro na verificação de reservas', err);
    if (expiradas.length > 0) {
      console.log(`Cancelando ${expiradas.length} reserva(s) expirada(s)...`);
      expiradas.forEach(reserva => {
        db.query("UPDATE reservas SET status = 'CANCELADA' WHERE id = ?", [reserva.id]);
        db.query("UPDATE materiais SET quantidade_estoque = quantidade_estoque + ? WHERE id = ?", [reserva.quantidade, reserva.material_id]);
      });
    }
  });
}, 60000); // Roda a cada 60 segundos

// LOGIN
app.post('/api/login', async (req, res) => {
  const { usuario, senha } = req.body; 
  db.query('SELECT * FROM usuarios WHERE email = ?', [usuario], async (err, results) => {
    if (results.length === 0 || !(await bcrypt.compare(senha, results[0].senha_hash))) {
      return res.status(401).json({ message: 'Credenciais inválidas!' });
    }
    const user = results[0];
    const token = jwt.sign({ id: user.id, perfil: user.perfil }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ success: true, token, user: { id: user.id, nome: user.nome, email: user.email, perfil: user.perfil }});
  });
});

// AUTO CADASTRO DE CLIENTE
app.post('/api/clientes/cadastro', async (req, res) => {
  const { nome, cpf, email } = req.body;
  db.query('SELECT * FROM usuarios WHERE email = ?', [email], async (err, usrs) => {
    if (usrs.length > 0) return res.status(400).json({ error: 'E-mail já cadastrado!' });
    
    db.query('INSERT INTO clientes (nome, cpf, email) VALUES (?, ?, ?)', [nome, cpf, email], async (err, result) => {
      if (err) return res.status(500).json({ error: 'Erro ao cadastrar cliente. Verifique o CPF.' });
      const clienteId = result.insertId;
      const senhaHash = await bcrypt.hash(cpf, 10);
      
      db.query('INSERT INTO usuarios (cliente_id, nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?, "CLIENTE")',
      [clienteId, nome, email, senhaHash], (err) => {
        if (err) return res.status(500).json({ error: 'Erro ao gerar usuário.' });
        res.status(201).json({ success: true, message: 'Cadastro realizado com sucesso!' });
      });
    });
  });
});

// COLABORADORES
app.get('/api/colaboradores', verificarToken, (req, res) => {
  db.query('SELECT * FROM colaboradores', (err, results) => res.json(results));
});
app.post('/api/colaboradores', verificarToken, async (req, res) => {
  const { nome, cpf, matricula, setor, cargo } = req.body;
  db.query('INSERT INTO colaboradores (nome, cpf, matricula, setor, cargo) VALUES (?, ?, ?, ?, ?)', 
  [nome, cpf, matricula, setor, cargo], async (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    const colabId = result.insertId;
    const email = gerarEmail(nome);
    const senhaHash = await bcrypt.hash(cpf, 10);
    db.query('INSERT INTO usuarios (colaborador_id, nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?, "COMUM")',
    [colabId, nome, email, senhaHash], () => {
      res.status(201).json({ message: 'Colaborador criado!', email: email, senha: cpf });
    });
  });
});
app.delete('/api/colaboradores/:id', verificarToken, (req, res) => {
  db.query('DELETE FROM colaboradores WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Colaborador removido!' });
  });
});

// MATERIAIS
app.get('/api/materiais', verificarToken, (req, res) => {
  db.query('SELECT * FROM materiais', (err, results) => res.json(results));
});
app.post('/api/materiais', verificarToken, (req, res) => {
  const { nome, codigo_barras, categoria, quantidade_estoque, preco_unitario } = req.body;
  db.query('INSERT INTO materiais (nome, codigo_barras, categoria, quantidade_estoque, unidade_medida, preco_unitario) VALUES (?, ?, ?, ?, "UN", ?)',
  [nome, codigo_barras, categoria, quantidade_estoque, preco_unitario], () => res.status(201).json({ success: true }));
});
app.delete('/api/materiais/:id', verificarToken, (req, res) => {
  db.query('DELETE FROM materiais WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(400).json({ error: 'Erro ao remover material. Pode estar vinculado a históricos.' });
    res.json({ message: 'Removido com sucesso!' });
  });
});

// RESERVAS (CLIENTES)
app.get('/api/reservas', verificarToken, (req, res) => {
  db.query('SELECT r.*, u.nome as cliente_nome, u.email as cliente_email, m.nome as material_nome FROM reservas r JOIN usuarios u ON r.usuario_id = u.id JOIN materiais m ON r.material_id = m.id ORDER BY id DESC', 
  (err, results) => res.json(results));
});
app.get('/api/reservas/usuario/:id', verificarToken, (req, res) => {
  db.query('SELECT r.*, m.nome as material_nome, m.preco_unitario FROM reservas r JOIN materiais m ON r.material_id = m.id WHERE r.usuario_id = ? ORDER BY id DESC', 
  [req.params.id], (err, results) => res.json(results));
});
app.post('/api/reservas', verificarToken, (req, res) => {
  const { usuario_id, material_id, quantidade } = req.body;
  db.query('SELECT quantidade_estoque FROM materiais WHERE id = ?', [material_id], (err, results) => {
    if (results[0].quantidade_estoque < quantidade) return res.status(400).json({ error: 'Estoque insuficiente.' });
    
    db.query('INSERT INTO reservas (usuario_id, material_id, quantidade, status) VALUES (?, ?, ?, "ATIVA")', 
    [usuario_id, material_id, quantidade], (err, result) => {
      if (err) return res.status(500).json({ error: 'Erro ao reservar.' });
      db.query('UPDATE materiais SET quantidade_estoque = quantidade_estoque - ? WHERE id = ?', [quantidade, material_id], () => {
        res.json({ success: true });
      });
    });
  });
});
app.put('/api/reservas/:id/confirmar', verificarToken, (req, res) => {
  db.query('UPDATE reservas SET status = "RETIRADA" WHERE id = ? AND status = "ATIVA"', [req.params.id], (err, result) => {
    if(result.affectedRows === 0) return res.status(400).json({error: 'Reserva já cancelada, retirada ou inexistente.'});
    res.json({ success: true });
  });
});

// REQUISIÇÕES (INTERNAS)
app.get('/api/requisicoes', verificarToken, (req, res) => {
  db.query('SELECT r.*, u.nome as usuario_nome, m.nome as material_nome FROM requisicoes r JOIN usuarios u ON r.usuario_id=u.id JOIN materiais m ON r.material_id=m.id ORDER BY id DESC', (err, results) => res.json(results));
});
app.get('/api/requisicoes/usuario/:id', verificarToken, (req, res) => {
  db.query('SELECT r.*, m.nome as material_nome FROM requisicoes r JOIN materiais m ON r.material_id=m.id WHERE r.usuario_id = ? ORDER BY id DESC', [req.params.id], (err, results) => res.json(results));
});
app.post('/api/requisicoes', verificarToken, (req, res) => {
  const { usuario_id, material_id, quantidade, obra_destino, motivo } = req.body;
  db.query('INSERT INTO requisicoes (usuario_id, material_id, quantidade, obra_destino, motivo) VALUES (?, ?, ?, ?, ?)',
  [usuario_id, material_id, quantidade, obra_destino, motivo], () => res.json({ success: true }));
});
app.put('/api/requisicoes/:id/processar', verificarToken, (req, res) => {
  const { status } = req.body;
  db.query('SELECT r.*, u.colaborador_id FROM requisicoes r JOIN usuarios u ON r.usuario_id=u.id WHERE r.id = ?', [req.params.id], (err, reqs) => {
    const requisicao = reqs[0];
    db.query('UPDATE requisicoes SET status = ? WHERE id = ?', [status, req.params.id], () => {
      if (status === 'APROVADA') {
        db.query('UPDATE materiais SET quantidade_estoque = quantidade_estoque - ? WHERE id = ?', [requisicao.quantidade, requisicao.material_id]);
      }
      res.json({ success: true });
    });
  });
});

app.listen(3000, () => console.log('SGMC V5 Atualizado na porta 3000'));
