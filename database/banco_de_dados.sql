CREATE DATABASE IF NOT EXISTS `petcare_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `petcare_db`;

-- 1. Tabela de Veterinários / Equipe Técnica (antiga colaboradores)
CREATE TABLE IF NOT EXISTS `veterinarios` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(100) NOT NULL,
  `cpf` VARCHAR(14) NOT NULL,
  `crmv` VARCHAR(20) NOT NULL,
  `especialidade` VARCHAR(50) NOT NULL,
  `status` ENUM('ATIVO', 'INATIVO') NOT NULL DEFAULT 'ATIVO',
  `criado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_vet_cpf` (`cpf` ASC),
  UNIQUE INDEX `uk_vet_crmv` (`crmv` ASC)
) ENGINE = InnoDB;

-- 2. Tabela de Tutores (antiga clientes)
CREATE TABLE IF NOT EXISTS `tutores` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(100) NOT NULL,
  `cpf` VARCHAR(14) NOT NULL,
  `telefone` VARCHAR(20) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `endereco` VARCHAR(255) NULL,
  `criado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_tutor_cpf` (`cpf` ASC),
  UNIQUE INDEX `uk_tutor_email` (`email` ASC)
) ENGINE = InnoDB;

-- 3. Tabela de Usuários (Controle de Acesso ao Sistema)
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `veterinario_id` INT NULL,
  `tutor_id` INT NULL,
  `nome` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `senha_hash` VARCHAR(255) NOT NULL,
  `perfil` ENUM('MASTER', 'VETERINARIO', 'RECEPCIONISTA', 'TUTOR') NOT NULL DEFAULT 'RECEPCIONISTA',
  `ativo` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_email` (`email` ASC),
  FOREIGN KEY (`veterinario_id`) REFERENCES `veterinarios` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`tutor_id`) REFERENCES `tutores` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB;

-- 4. Tabela de Pets (antiga materiais, agora vinculada ao Tutor)
CREATE TABLE IF NOT EXISTS `pets` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tutor_id` INT NOT NULL,
  `nome` VARCHAR(100) NOT NULL,
  `microchip` VARCHAR(50) NULL,
  `especie` ENUM('CAO', 'GATO', 'AVE', 'ROEDOR', 'OUTRO') NOT NULL,
  `raca` VARCHAR(50) NOT NULL DEFAULT 'SRD',
  `sexo` ENUM('M', 'F') NOT NULL,
  `data_nascimento` DATE NULL,
  `peso_kg` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `criado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_microchip` (`microchip` ASC),
  FOREIGN KEY (`tutor_id`) REFERENCES `tutores` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB;

-- 5. Tabela de Consultas / Atendimentos (antigas retiradas/reservas)
CREATE TABLE IF NOT EXISTS `consultas` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `pet_id` INT NOT NULL,
  `veterinario_id` INT NOT NULL,
  `usuario_id` INT NOT NULL,
  `data_consulta` DATETIME NOT NULL,
  `tipo_atendimento` ENUM('CONSULTA', 'VACINA', 'EXAME', 'CIRURGIA', 'RETORNO') NOT NULL DEFAULT 'CONSULTA',
  `status` ENUM('AGENDADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA') NOT NULL DEFAULT 'AGENDADA',
  `observacoes` TEXT NULL,
  `valor` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `criado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`pet_id`) REFERENCES `pets` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`veterinario_id`) REFERENCES `veterinarios` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB;

-- ADMIN DEFAULT (Senha: Admin1234)
INSERT INTO `usuarios` (`nome`, `email`, `senha_hash`, `perfil`) VALUES
('Administrador', 'admin@petcare.com.br', '$2b$10$LW8RmvopWeTWnomp0F0.VukLdluQUKtzqDcA4oyVl7PwCEyGXwBK6', 'MASTER');