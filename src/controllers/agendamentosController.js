const { db, admin } = require("../config/firebase");

exports.createAgendamento = async (req, res) => {
  try {
    const { id_empresa } = req.params;
    const requiredFields = ["horario", "nome", "servicos", "valor"];
    const data = req.body;

    // Verificar campos obrigatórios
    const missingFields = requiredFields.filter((field) => !data[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `Os seguintes campos estão faltando: ${missingFields.join(", ")}`,
      });
    }

    // Garantir que "horario" tenha exatamente dois timestamps
    if (!Array.isArray(data.horario) || data.horario.length !== 2) {
      return res.status(400).json({
        error: "O campo 'horario' deve ser um array com dois timestamps (start e end).",
      });
    }

    // Criar agendamento no Firestore
    const docRef = await db
      .collection("profissionais")
      .doc(id_empresa)
      .collection("agendamentos")
      .add({
        horario: data.horario,
        nome: data.nome,
        observacao: data.observacao || "",
        servicos: data.servicos,
        valor: data.valor,
      });

    res.status(201).json({
      message: "Agendamento criado com sucesso!",
      id: docRef.id,
    });
  } catch (error) {
    res.status(500).json({
      error: "Erro ao criar agendamento.",
      details: error.message,
    });
  }
};

exports.getAllAgendamentos = async (req, res) => {
    try {
      const { id_empresa } = req.params;
  
      // Obter todos os agendamentos da empresa
      const snapshot = await db
        .collection("profissionais")
        .doc(id_empresa)
        .collection("agendamentos")
        .get();
  
      const agendamentos = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
  
      res.status(200).json(agendamentos);
    } catch (error) {
      res.status(500).json({
        error: "Erro ao listar agendamentos.",
        details: error.message,
      });
    }
  };

  exports.getAgendamentoById = async (req, res) => {
    try {
      const { id_empresa, id_agendamento } = req.params;
  
      // Obter agendamento pelo ID
      const docRef = db
        .collection("profissionais")
        .doc(id_empresa)
        .collection("agendamentos")
        .doc(id_agendamento);
  
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Agendamento não encontrado." });
      }
  
      res.status(200).json({ id: doc.id, ...doc.data() });
    } catch (error) {
      res.status(500).json({
        error: "Erro ao obter agendamento.",
        details: error.message,
      });
    }
  };

  exports.updateAgendamento = async (req, res) => {
    try {
      const { id_empresa, id_agendamento } = req.params;
      const validFields = ["horario", "nome", "observacao", "servicos", "valor"];
      const updates = req.body;
  
      // Verificar se o agendamento existe
      const docRef = db
        .collection("profissionais")
        .doc(id_empresa)
        .collection("agendamentos")
        .doc(id_agendamento);
  
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Agendamento não encontrado." });
      }
  
      // Filtrar campos válidos
      const filteredUpdates = {};
      for (const key in updates) {
        if (validFields.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      }
  
      // Verificar se há campos para atualizar
      if (Object.keys(filteredUpdates).length === 0) {
        return res.status(400).json({
          error: "Nenhum campo válido foi enviado para atualização.",
        });
      }
  
      // Atualizar agendamento no Firestore
      await docRef.update(filteredUpdates);
  
      res.status(200).json({
        message: "Agendamento atualizado com sucesso.",
        updatedFields: filteredUpdates,
      });
    } catch (error) {
      res.status(500).json({
        error: "Erro ao atualizar agendamento.",
        details: error.message,
      });
    }
  };

  exports.deleteAgendamento = async (req, res) => {
    try {
      const { id_empresa, id_agendamento } = req.params;
  
      // Verificar se o agendamento existe
      const docRef = db
        .collection("profissionais")
        .doc(id_empresa)
        .collection("agendamentos")
        .doc(id_agendamento);
  
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Agendamento não encontrado." });
      }
  
      // Excluir agendamento
      await docRef.delete();
  
      res.status(200).json({ message: "Agendamento excluído com sucesso." });
    } catch (error) {
      res.status(500).json({
        error: "Erro ao excluir agendamento.",
        details: error.message,
      });
    }
  };
  