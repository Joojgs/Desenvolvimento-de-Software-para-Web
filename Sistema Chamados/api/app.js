const express = require('express');
const cors = require('cors');
const chamadosRoutes = require('./src/routes/chamados');
const tecnicosRoutes = require('./src/routes/tecnicos');

const app = express();
app.use(express.json());

app.use(cors());

app.get('/', (req, res) => {
    res.send('API rodando.');
});

// Rotas
app.use('/chamados', chamadosRoutes);
app.use('/tecnicos', tecnicosRoutes);

app.listen(3000, () => {
  console.log('API rodando na porta 3000');
});

