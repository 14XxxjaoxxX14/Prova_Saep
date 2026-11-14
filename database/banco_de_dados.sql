CREATE DATABASE IF NOT EXISTS `sgmc_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `sgmc_db`;

CREATE TABLE IF NOT EXISTS `colaboradores` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(100) NOT NULL,
  `cpf` VARCHAR(14) NOT NULL,
  `matricula` VARCHAR(20) NOT NULL,
  `setor` VARCHAR(50) NOT NULL,
  `cargo` VARCHAR(50) NOT NULL,
  `status` ENUM('ATIVO', 'INATIVO') NOT NULL DEFAULT 'ATIVO',
  `criado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_cpf` (`cpf` ASC),
  UNIQUE INDEX `uk_matricula` (`matricula` ASC)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS `clientes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(100) NOT NULL,
  `cpf` VARCHAR(14) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `criado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_cli_cpf` (`cpf` ASC),
  UNIQUE INDEX `uk_cli_email` (`email` ASC)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `colaborador_id` INT NULL,
  `cliente_id` INT NULL,
  `nome` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `senha_hash` VARCHAR(255) NOT NULL,
  `perfil` VARCHAR(30) NOT NULL DEFAULT 'COMUM',
  `ativo` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_email` (`email` ASC),
  FOREIGN KEY (`colaborador_id`) REFERENCES `colaboradores` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS `materiais` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(100) NOT NULL,
  `codigo_barras` VARCHAR(50) NOT NULL,
  `categoria` VARCHAR(50) NOT NULL,
  `quantidade_estoque` INT NOT NULL DEFAULT 0,
  `unidade_medida` VARCHAR(20) NOT NULL,
  `preco_unitario` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_codigo` (`codigo_barras` ASC)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS `retiradas` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `colaborador_id` INT NOT NULL,
  `material_id` INT NOT NULL,
  `usuario_id` INT NOT NULL,
  `data_retirada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `quantidade` INT NOT NULL,
  `obra_destino` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`colaborador_id`) REFERENCES `colaboradores` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`material_id`) REFERENCES `materiais` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS `requisicoes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `usuario_id` INT NOT NULL,
  `material_id` INT NOT NULL,
  `quantidade` INT NOT NULL,
  `obra_destino` VARCHAR(100) NOT NULL,
  `status` ENUM('PENDENTE', 'APROVADA', 'REJEITADA') NOT NULL DEFAULT 'PENDENTE',
  `motivo` VARCHAR(255) NOT NULL,
  `criado_em` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`material_id`) REFERENCES `materiais` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS `reservas` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `usuario_id` INT NOT NULL,
  `material_id` INT NOT NULL,
  `quantidade` INT NOT NULL,
  `status` ENUM('ATIVA', 'RETIRADA', 'CANCELADA') NOT NULL DEFAULT 'ATIVA',
  `data_reserva` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`material_id`) REFERENCES `materiais` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB;

-- ADMIN DEFAULT (Senha: Admin1234)
INSERT INTO `usuarios` (`nome`, `email`, `senha_hash`, `perfil`) VALUES
('Administrador', 'admin@sgmc.com.br', '$2b$10$LW8RmvopWeTWnomp0F0.VukLdluQUKtzqDcA4oyVl7PwCEyGXwBK6', 'MASTER');
