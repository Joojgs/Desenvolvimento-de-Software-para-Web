const pool = require('../db');

// Listar todos os chamados
exports.listar = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM chamados');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Cadastrar novo chamado
exports.cadastrar = async (req, res) => {
  try {
    const { problem, status, prioridade } = req.body;
    await pool.query(
      'INSERT INTO chamados (problem, status, prioridade) VALUES (?,?,?)',
      [problem, status, prioridade]
    );
    res.json({ message: 'Chamado cadastrado!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Editar chamado existente
exports.editar = async (req, res) => {
  try {
    const { id } = req.params;
    const { problem, status, prioridade } = req.body;
    await pool.query(
      'UPDATE chamados SET problem=?, status=?, prioridade=? WHERE id=?',
      [problem, status, prioridade, id]
    );
    res.json({ message: 'Chamado atualizado!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Remover chamado
exports.remover = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM chamados WHERE id=?', [id]);
    res.json({ message: 'Chamado removido!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
