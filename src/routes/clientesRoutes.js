const express = require("express");
const router = express.Router();
const clientesController = require("../controllers/clientesController");

// Rotas para clientes
router.post("/:id_empresa/clientes", clientesController.createCliente);
router.get("/:id_empresa/clientes", clientesController.getAllClientes);
router.get("/:id_empresa/clientes/:id_cliente", clientesController.getClienteById);
router.put("/:id_empresa/clientes/:id_cliente", clientesController.updateCliente);
router.delete("/:id_empresa/clientes/:id_cliente", clientesController.deleteCliente);

module.exports = router;
