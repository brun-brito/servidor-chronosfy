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
        error: `O horário selecionado está fora do intervalo definido no horário de funcionamento (${horarioHoje[0]} - ${horarioHoje[1]}).`,
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

    const id_user = data.id || db.collection("profissionais").doc().id; 

    // Criar agendamento no Firestore
    const docRef = await db
      .collection("profissionais")
      .doc(id_empresa)
      .collection("agendamentos")
      .add({
        id_user: id_user,
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
      const updates = req.body;
  
      // Referência ao Firestore
      const profissionaisRef = db.collection("profissionais").doc(id_empresa);
      const docRef = profissionaisRef.collection("agendamentos").doc(id_agendamento);
  
      // Verificar se o agendamento existe
      const agendamentoDoc = await docRef.get();
      if (!agendamentoDoc.exists) {
        return res.status(404).json({ error: "Agendamento não encontrado." });
      }
  
      const agendamentoAtual = agendamentoDoc.data();
  
      // Obter informações do profissional
      const profissionalDoc = await profissionaisRef.get();
      if (!profissionalDoc.exists) {
        return res.status(404).json({ error: "Profissional não encontrado." });
      }
  
      const { servicos: servicosDisponiveis, horario_funcionamento } = profissionalDoc.data();
  
      // Atualizações Condicionais
      const updatesToApply = {};
  
      // Nome
      if (updates.nome && updates.nome !== agendamentoAtual.nome) {
        updatesToApply.nome = updates.nome;
      }

      // Validar e calcular valor e tempo
      const servicosSelecionados = updates.servicos.map((nomeServico) => {
        const servico = servicosDisponiveis.find((s) => s.nome === nomeServico);
        if (!servico) {
          throw new Error(`Serviço "${nomeServico}" não encontrado.`);
        }
        return servico;
      });
      const tempoTotal = servicosSelecionados.reduce((acc, servico) => acc + servico.tempo_estimado, 0);
      const valorTotal = servicosSelecionados.reduce((acc, servico) => acc + servico.valor, 0);
      const start = new Date(updates.horario[0]);
      const end = new Date(start.getTime() + tempoTotal * 60 * 1000);
      
      // Horário
      if (updates.horario && Array.isArray(updates.horario) && updates.horario.length > 0) {
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
  
        if (start < horarioInicio || start > horarioFim) {
          return res.status(400).json({
            error: `O horário selecionado está fora do intervalo definido no horário de funcionamento (${horarioHoje[0]} - ${horarioHoje[1]})`,
          });
        }
  
        // Validar conflitos de agendamento
        const agendamentosSnapshot = await profissionaisRef
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
              agendamento.id !== updates.id && // Verifica se não é o mesmo agendamento
              start < agendamentoEnd &&
              end > agendamentoStart // Intervalos sobrepostos
            );
          });
      
          if (conflito) {
            return res.status(400).json({
              error: "O horário selecionado já está ocupado por outro agendamento.",
            });
          }
  
        updatesToApply.horario = { inicio: start, fim: end };
      }
  
      // Serviços
      if (Array.isArray(updates.servicos)) {
        if (updates.servicos.length === 0) {
          return res.status(400).json({
            error: "É necessário selecionar pelo menos um serviço.",
          });
        }
  
        updatesToApply.servicos = updates.servicos;
        updatesToApply.valor = valorTotal;
  
        // Recalcular horários
        if (updates.horario && Array.isArray(updates.horario) && updates.horario.length > 0) {
          const start = new Date(updates.horario[0]);
          const end = new Date(start.getTime() + tempoTotal * 60 * 1000);
          updatesToApply.horario = { inicio: start, fim: end };
        }
      }
  
      // Observação
      if (updates.observacao && updates.observacao !== agendamentoAtual.observacao) {
        updatesToApply.observacao = updates.observacao;
      }
  
      // Atualizar agendamento no Firestore
      if (Object.keys(updatesToApply).length > 0) {
        await docRef.update(updatesToApply);
        return res.status(200).json({
          message: "Agendamento atualizado com sucesso.",
          updatedFields: updatesToApply,
        });
      } else {
        return res.status(400).json({
          error: "Nenhuma mudança válida foi enviada para atualização.",
        });
      }
    } catch (error) {
      console.error("Erro ao atualizar agendamento:", error);
      res.status(500).json({
        error: "Erro interno ao atualizar agendamento.",
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
  