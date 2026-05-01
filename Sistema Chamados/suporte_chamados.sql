CREATE DATABASE suporte_tecnico;
USE suporte_tecnico;

CREATE TABLE chamados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  problem VARCHAR(255) NOT NULL,
  status ENUM('aberto','em andamento','resolvido') DEFAULT 'aberto',
  prioridade ENUM('baixa','media','alta') DEFAULT 'media'
);

CREATE TABLE tecnicos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  especialidade VARCHAR(100) NOT NULL
);

select * from chamados;
select * from tecnicos;


