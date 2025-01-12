const { db, admin } = require("../config/firebase");
const { Timestamp } = require("firebase-admin/firestore");

exports.getRelatorios = async (req, res) => {
  const { id_empresa } = req.params; // ID da empresa passada como parâmetro
  const { startDate, endDate } = req.query;

  if (!id_empresa) {
    return res.status(400).json({ error: "O parâmetro id_empresa é obrigatório." });
  }

  if (!startDate || !endDate) {
    return res
      .status(400)
      .json({ error: "Os parâmetros startDate e endDate são obrigatórios." });
  }

  try {
    const start = Timestamp.fromDate(new Date(startDate));
    const end = Timestamp.fromDate(new Date(endDate));


    // Referência à coleção de agendamentos
    const agendamentosRef = db
      .collection("profissionais")
      .doc(id_empresa)
      .collection("agendamentos");

    const snapshot = await agendamentosRef
      .where("horario.inicio", ">=", start)
      .where("horario.fim", "<=", end)
      .get();

    if (snapshot.empty) {
      return res.json({
        mensagem: "Nenhum dado encontrado para o período.",
        periodo: { inicio: startDate, fim: endDate },
      });
    }

    const agendamentos = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));


    // Cálculo do faturamento total
    const faturamentoTotal = agendamentos.reduce(
      (total, agendamento) => total + agendamento.valor,
      0
    );

    // Lista de clientes que visitaram
    const clientesVisitados = agendamentos.reduce((clientesMap, agendamento) => {
        const { id_user, nome, valor, servicos } = agendamento;
      
        // Se o cliente já existe no mapa, atualize os dados
        if (clientesMap[id_user]) {
          clientesMap[id_user].valor += valor; // Soma os valores
          clientesMap[id_user].servicos = Array.from(
            new Set([...clientesMap[id_user].servicos, ...servicos]) // Combina os serviços, removendo duplicados
          );
          clientesMap[id_user].visitas += 1;
        } else {
          // Caso contrário, adicione o cliente ao mapa
          clientesMap[id_user] = {
            // id: id_user,
            nome,
            valor,
            servicos,
            visitas: 1,
          };
        }
      
        return clientesMap;
    }, {});

    // Serviço mais utilizado
    const frequenciaServicos = {};
    agendamentos.forEach((agendamento) => {
      agendamento.servicos.forEach((servico) => {
        frequenciaServicos[servico] = (frequenciaServicos[servico] || 0) + 1;
      });
    });

    const servicoMaisUtilizado = Object.entries(frequenciaServicos).reduce(
      (maisUtilizado, [nomeServico, frequencia]) =>
        frequencia > maisUtilizado.frequencia
          ? { nomeServico, frequencia }
          : maisUtilizado,
      { nomeServico: null, frequencia: 0 }
    );


    res.json({
      periodo: { inicio: startDate, fim: endDate },
      servicoMaisUtilizado: servicoMaisUtilizado,
      faturamentoTotal: faturamentoTotal,
      clientesVisitados: clientesVisitados,
      totalAgendamentos: agendamentos.length,
    });
  } catch (error) {
    console.error("[ERRO] Erro ao gerar relatório:", error);
    res
      .status(500)
      .json({ error: "Erro ao gerar relatório.", detalhes: error.message });
  }
};
