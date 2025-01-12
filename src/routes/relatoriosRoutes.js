const express = require("express");
const router = express.Router();
const relatoriosController = require("../controllers/relatoriosController");

router.get("/:id_empresa/relatorios", relatoriosController.getRelatorios);

module.exports = router;