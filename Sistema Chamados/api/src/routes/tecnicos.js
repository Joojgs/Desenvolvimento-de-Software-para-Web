const express = require('express');
const router = express.Router();
const tecnicoController = require('../controllers/tecnicoController');

router.get('/', tecnicoController.listar);
router.post('/', tecnicoController.cadastrar);
router.put('/:id', tecnicoController.editar);
router.delete('/:id', tecnicoController.remover);

module.exports = router;
