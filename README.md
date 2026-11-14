# 🏗️ SGMC - Sistema de Gerenciamento de Materiais de Construção

![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)
![Express](https://img.shields.io/badge/Express-4.x-lightgrey.svg)
![MySQL](https://img.shields.io/badge/MySQL-8.0-orange.svg)

O **SGMC** é um sistema web desenvolvido para gerir o fluxo logístico e de vendas de uma loja de materiais de construção. Ele suporta múltiplos perfis de acesso: **Administrador (Master)**, **Colaborador (Comum)** e **Cliente**. O sistema permite o auto-registo de clientes, reserva online de produtos com expiração automática, requisições internas de materiais para obras e uma gestão centralizada do inventário.

---

## ⚙️ 1. Pré-requisitos

Antes de iniciar, certifique-se de ter instalado em sua máquina:
* **Node.js** (v18 ou superior)
* **MySQL Server** (ou softwares como XAMPP, WAMP, MySQL Workbench)
* Editor de código (ex: VS Code)

---

## 📂 2. Estrutura do Projeto

Baseado na arquitetura do sistema, a organização de pastas é a seguinte:

```text
sgmc_sistema/
│
├── .vscode/                 # Configurações locais do VS Code
│   └── settings.json
│
├── database/                # Scripts de Banco de Dados
│   └── banco_de_dados.sql   # Script de criação das tabelas (clientes, reservas, etc.)
│
├── public/                  # Frontend (Arquivos Estáticos)
│   ├── assets/
│   │   └── css/
│   │       └── style.css    # Estilos customizados
│   ├── index.html           # Painel Administrativo (Master)
│   ├── login.html           # Tela de Login e Auto-Cadastro
│   ├── painel_cliente.html  # Painel de Reservas do Cliente
│   └── painel_comum.html    # Painel de Requisições Internas (Colaboradores)
│
├── .env                     # Variáveis de ambiente (NÃO VERSIONAR)
├── .gitignore               # Regras de ignorar ficheiros no Git
├── package.json             # Dependências do projeto Node.js
└── server.js                # Backend Principal (API Express + Rotina 24h)
```

---

## 🚀 3. Guia de Instalação e Configuração

### Passo 1: Preparar os arquivos
Extraia o conteúdo do arquivo `.zip` fornecido ou clone o repositório e abra a pasta do projeto no seu terminal.

### Passo 2: Configurar o Banco de Dados
1. Abra o seu gerenciador do MySQL (ex: MySQL Workbench ou phpMyAdmin).
2. Conecte-se ao seu servidor local.
3. Abra o arquivo `database/banco_de_dados.sql`.
4. Execute todo o script. Isso criará o banco `sgmc_db` e todas as tabelas mais recentes (`clientes`, `reservas`, `usuarios`, `materiais`, etc.).

### Passo 3: Configurar Variáveis de Ambiente
1. Na raiz do projeto, crie um arquivo chamado `.env`.
2. Preencha com as suas credenciais do MySQL e configure a chave de segurança:
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha_do_mysql_aqui
DB_NAME=sgmc_db
JWT_SECRET=super_chave_secreta_sgmc_2026
```

### Passo 4: Instalar as Dependências
No terminal, dentro da pasta do projeto, instale os pacotes necessários:
```bash
npm install express mysql2 cors bcrypt jsonwebtoken dotenv
```

### Passo 5: Iniciar o Servidor
Ainda no terminal, execute:
```bash
node server.js
```
*Se aparecer a mensagem "SGMC V5 Atualizado na porta 3000", o sistema está online e o cronjob de expiração de reservas foi ativado!*

---

## 📖 4. Passo a Passo de Utilização do Sistema

### 4.1. Auto-Cadastro e Acesso (Login)
1. Acesse: `http://localhost:3000/login.html`
2. **Novos Clientes:** Podem clicar em "Cadastrar-se" na tela de login. Após informar Nome, CPF (apenas números) e E-mail, a conta é criada. **A senha inicial do cliente será o próprio CPF**.
3. **Login:** Faça login com o seu e-mail e senha. O sistema redirecionará automaticamente para o painel correto com base no seu perfil (`MASTER`, `COMUM` ou `CLIENTE`).

### 4.2. Painel do Cliente (Reservas)
1. Ao fazer login, o cliente é redirecionado para a Loja Virtual.
2. Na aba **"Realizar Reserva"**, o cliente seleciona o produto desejado e informa a quantidade. O sistema valida se há estoque.
3. Ao confirmar, o produto fica reservado e bloqueado no estoque global. O cliente tem **24 horas** para ir até a loja física realizar o pagamento e a retirada. 
4. Passadas 24h sem retirada, o sistema cancela a reserva automaticamente e devolve o produto ao estoque.

### 4.3. Painel Administrativo (Master)
Acesso restrito ao administrador (email padrão do script SQL: `admin@sgmc.com.br` / senha: `Admin1234`).
*   **Aba Colaboradores:** Permite cadastrar novos funcionários. Ao salvar, um pop-up elegante exibirá o e-mail gerado e a senha temporária para ser partilhada com o funcionário.
*   **Aba Materiais:** Gestão de inventário. Adicione novos produtos definindo o nome, código de barras, estoque inicial e **preço de venda**.
*   **Aba Requisições (Internas):** Controle de pedidos de materiais feitos por colaboradores para uso em obras internas. O administrador pode "Aprovar" (deduzindo do estoque) ou "Rejeitar".
*   **Aba Reservas (Clientes):** Visualização em tempo real das reservas feitas pelos clientes online. Quando o cliente comparecer à loja, o administrador clica em **"Confirmar Retirada"**, finalizando o processo.

### 4.4. Painel Comum (Colaboradores)
1. Destinado a funcionários de almoxarifado ou engenheiros de obra.
2. Permite realizar o pedido (requisição) de materiais específicos e atrelar esse pedido a uma "Obra de Destino".
3. Acompanhamento em tempo real se o pedido foi Aprovado ou Rejeitado pelo administrador.

---

## 🛠️ Tecnologias Utilizadas
* **Backend:** Node.js, Express, MySQL2, JWT (JSON Web Tokens), Bcrypt.
* **Frontend:** HTML5, CSS3, Bootstrap 5 (Modals interativos e design responsivo).
* **Processos em Background:** JavaScript `setInterval` para expiração automática de reservas ativas (Timeout de 24h).

## 📄 Licença
Projeto acadêmico / uso interno para controle de depósitos e lojas.

┌─────────────────────────────────────────────────────────┐
 │               SGMC - ARQUITETURA DO SISTEMA             │
 └─────────────────────────────────────────────────────────┘

 📁 sgmc_sistema/
 │
 ├── ⚙️ CONFIGURAÇÃO DE AMBIENTE
 │    ├── .env                <- Credenciais do BD e Chave JWT (Segurança)
 │    ├── .gitignore          <- Ignora ficheiros indesejados no Git
 │    ├── package.json        <- Lista de dependências Node.js
 │    └── .vscode/            <- Configurações do seu editor
 │         └── settings.json
 │
 ├── 🗄️ BANCO DE DADOS
 │    └── database/ 
 │         └── banco_de_dados.sql  <- Script SQL (Estrutura e Tabelas)
 │                                    - clientes, colaboradores, usuarios
 │                                    - materiais, reservas, requisicoes
 │
 ├── 🧠 BACKEND (Node.js + Express)
 │    └── server.js           <- O Cérebro da Aplicação
 │                                1. Rotas de API (Login, Materiais, etc.)
 │                                2. Validação de Tokens JWT
 │                                3. Job 24h: Cancela reservas expiradas
 │
 └── 🌐 FRONTEND (public/)    <- A Interface do Utilizador (Visão)
      │
      ├── 🎨 assets/css/
      │    └── style.css      <- Regras de design e cores globais
      │
      ├── 🚪 login.html       <- Porta de Entrada
      │                          - Faz a autenticação do utilizador
      │                          - Modal para Auto-Cadastro de Clientes
      │
      ├── 👑 index.html       <- Painel Master (Administrador)
      │                          - Cadastra colaboradores / materiais
      │                          - Aprova requisições de obras
      │                          - Confirma retirada de clientes na loja
      │
      ├── 🛒 painel_cliente.html <- Painel do Consumidor
      │                             - Visualiza loja e preços
      │                             - Reserva produtos com validade de 24h
      │
      └── 👷 painel_comum.html   <- Painel do Funcionário (Obra)
                                    - Pede materiais ao almoxarifado
                                    - Acompanha status da requisição