const { db, admin } = require("../config/firebase");
const { Timestamp } = require("firebase-admin/firestore");

exports.createAgendamento = async (req, res) => {
  try {
    const { id_empresa } = req.params;
    const requiredFields = ["horario", "nome", "servicos"];
    const data = req.body;

    // Verificar campos obrigatórios
    const missingFields = requiredFields.filter((field) => !data[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `Os seguintes campos estão faltando: ${missingFields.join(", ")}`,
      });
    }

    // Validar serviços e calcular o tempo total
    if (!Array.isArray(data.servicos) || data.servicos.length === 0) {
      return res.status(400).json({ error: "É necessário selecionar pelo menos um serviço." });
    }

    const profissionalDoc = await db.collection("profissionais").doc(id_empresa).get();
    if (!profissionalDoc.exists) {
      return res.status(404).json({ error: "Profissional não encontrado." });
    }

    const { horario_funcionamento, servicos } = profissionalDoc.data();

    const servicosEscolhidos = data.servicos.map((servicoNome) => {
      const servico = servicos.find((s) => s.nome === servicoNome);
      if (!servico) {
        throw new Error(`Serviço "${servicoNome}" não encontrado.`);
      }
      return servico;
    });

    const tempoTotal = servicosEscolhidos.reduce((total, servico) => total + servico.tempo_estimado, 0);

    console.log("Tempo total necessário (minutos):", tempoTotal);

    // Calcular horário de início e término
    const start = new Date(data.horario[0]);
    const end = new Date(start.getTime() + tempoTotal * 60 * 1000); // Adicionar o tempo em milissegundos

    console.log("Horário solicitado (start):", start);
    console.log("Horário solicitado (end):", end);

    // Validar horário de funcionamento
    const diaSemana = start.toLocaleDateString("pt-BR", { weekday: "short" }).toLowerCase();
    const removeAcentos = (str) =>
      str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
    const diaSemanaKey = removeAcentos(diaSemana);

    const horarioHoje = horario_funcionamento[diaSemanaKey];
    if (!horarioHoje) {
      return res.status(400).json({
        error: "Este dia não possui horário de funcionamento definido.",
      });
    }

    const horarioInicio = new Date(`${start.toISOString().split("T")[0]}T${horarioHoje[0]}:00`);
    const horarioFim = new Date(`${start.toISOString().split("T")[0]}T${horarioHoje[1]}:00`);

    if (start < horarioInicio || end > horarioFim) {
      return res.status(400).json({
        error: "O horário selecionado está fora do intervalo definido no horário de funcionamento.",
      });
    }

    // Consultar agendamentos existentes
    const agendamentosSnapshot = await db
      .collection("profissionais")
      .doc(id_empresa)
      .collection("agendamentos")
      .where("horario.inicio", ">=", Timestamp.fromDate(horarioInicio))
      .where("horario.fim", "<=", Timestamp.fromDate(horarioFim))
      .get();

    const agendamentos = agendamentosSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      horario: {
        inicio: doc.data().horario.inicio.toDate(),
        fim: doc.data().horario.fim.toDate(),
      },
    }));

    console.log("Agendamentos encontrados:", agendamentos);

    // Verificar conflitos detalhados
    const conflito = agendamentos.some((agendamento) => {
      const { inicio: agendamentoStart, fim: agendamentoEnd } = agendamento.horario;

      console.log("Comparando com agendamento existente:", {
        agendamentoStart,
        agendamentoEnd,
        start,
        end,
      });

      return (
        (start < agendamentoEnd && end > agendamentoStart) // Intervalos sobrepostos
      );
    });

    if (conflito) {
      return res.status(400).json({
        error: "O horário selecionado já está ocupado por outro agendamento.",
      });
    }

    // Criar agendamento no Firestore
    const docRef = await db
      .collection("profissionais")
      .doc(id_empresa)
      .collection("agendamentos")
      .add({
        horario: { inicio: Timestamp.fromDate(start), fim: Timestamp.fromDate(end) },
        nome: data.nome,
        observacao: data.observacao || "",
        servicos: data.servicos,
        valor: servicosEscolhidos.reduce((total, servico) => total + servico.valor, 0), // Somar valores dos serviços
      });

    console.log("Agendamento criado com sucesso:", { id: docRef.id, ...data });

    res.status(201).json({
      message: "Agendamento criado com sucesso!",
      id: docRef.id,
    });
  } catch (error) {
    console.error("Erro ao criar agendamento:", error);
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
  