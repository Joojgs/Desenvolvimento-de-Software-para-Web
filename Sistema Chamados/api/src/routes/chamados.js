const express = require('express');
const router = express.Router();
const chamadoController = require('../controllers/chamadoController');

router.get('/', chamadoController.listar);
router.post('/', chamadoController.cadastrar);
router.put('/:id', chamadoController.editar);
router.delete('/:id', chamadoController.remover);

module.exports = router;
