const express = require("express");
const router = express.Router();
const agendamentosController = require("../controllers/agendamentosController");

// Rotas para agendamentos
router.post("/:id_empresa/agendamentos", agendamentosController.createAgendamento);
router.get("/:id_empresa/agendamentos", agendamentosController.getAllAgendamentos);
router.get("/:id_empresa/agendamentos/:id_agendamento", agendamentosController.getAgendamentoById);
router.put("/:id_empresa/agendamentos/:id_agendamento", agendamentosController.updateAgendamento);
router.delete("/:id_empresa/agendamentos/:id_agendamento", agendamentosController.deleteAgendamento);

module.exports = router;
