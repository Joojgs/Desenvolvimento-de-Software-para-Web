const pool = require('../db');

// Listar todos os técnicos
exports.listar = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tecnicos');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Cadastrar novo técnico
exports.cadastrar = async (req, res) => {
  try {
    const { nome, especialidade } = req.body;
    await pool.query(
      'INSERT INTO tecnicos (nome, especialidade) VALUES (?,?)',
      [nome, especialidade]
    );
    res.json({ message: 'Técnico cadastrado!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Editar técnico existente
exports.editar = async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, especialidade } = req.body;
    await pool.query(
      'UPDATE tecnicos SET nome=?, especialidade=? WHERE id=?',
      [nome, especialidade, id]
    );
    res.json({ message: 'Técnico atualizado!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Remover técnico
exports.remover = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM tecnicos WHERE id=?', [id]);
    res.json({ message: 'Técnico removido!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
