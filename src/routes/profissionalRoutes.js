const express = require("express");
const router = express.Router();
const profissionalController = require("../controllers/profissionalController");

router.post("/", profissionalController.createProfissional);
router.get("/:id", profissionalController.getProfissionalById);
router.put("/:id", profissionalController.updateProfissional);

module.exports = router;
