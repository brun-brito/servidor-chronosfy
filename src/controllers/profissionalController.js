const { db, admin } = require("../config/firebase");

exports.createProfissional = async (req, res) => {
    try {
      const requiredFields = [
        "nome",
        "email",
        "telefone",
        "horario_funcionamento",
        "servicos",
        "endereco",
      ];
      const optionalFields = ["cnpj", "cpf"]; // Um dos dois deve estar presente
  
      const data = req.body;
  
      // Verificar campos obrigatórios
      const missingFields = requiredFields.filter((field) => !data[field]);
      if (missingFields.length > 0) {
        return res.status(400).json({
          error: `Os seguintes campos estão faltando: ${missingFields.join(", ")}`,
        });
      }
  
      // Verificar se pelo menos "cnpj" ou "cpf" foi fornecido
      if (!data.cnpj && !data.cpf) {
        return res.status(400).json({
          error: "É necessário informar pelo menos o campo 'cnpj' ou 'cpf'.",
        });
      }
  
      // Garantir que todos os dias da semana estejam no horario_funcionamento
      const defaultSchedule = {
        dom: null,
        seg: null,
        ter: null,
        qua: null,
        qui: null,
        sex: null,
        sab: null,
      };
  
      const horario_funcionamento = {
        ...defaultSchedule,
        ...data.horario_funcionamento,
      };
  
      // Filtrar campos extras
      const validData = {
        nome: data.nome,
        cnpj: data.cnpj || null,
        cpf: data.cpf || null,
        email: data.email,
        telefone: data.telefone,
        endereco: data.endereco,
        horario_funcionamento,
        servicos: data.servicos,
      };
  
      // Salvar no Firestore
      const docRef = await db.collection("profissionais").add(validData);
  
      res.status(201).json({
        message: "Profissional criado com sucesso!",
        id: docRef.id,
        data: validData,
      });
    } catch (error) {
      res.status(500).json({
        error: "Erro ao criar profissional.",
        details: error.message,
      });
    }
  };

exports.getProfissionalById = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection("profissionais").doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ message: "Profissional não encontrado" });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateProfissional = async (req, res) => {
    try {
      const { id } = req.params; // ID do profissional na URL
      const validFields = [
        "nome",
        "cnpj",
        "cpf",
        "email",
        "telefone",
        "endereco", // Novo campo permitido
        "horario_funcionamento",
        "servicos",
      ]; // Campos permitidos para atualização
  
      const updates = req.body;
  
      // Verificar se o documento existe
      const docRef = db.collection("profissionais").doc(id);
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Profissional não encontrado." });
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
  
      // Atualizar documento no Firestore
      await docRef.update(filteredUpdates);
  
      res.status(200).json({
        message: "Profissional atualizado com sucesso.",
        updatedFields: filteredUpdates,
      });
    } catch (error) {
      res.status(500).json({
        error: "Erro ao atualizar profissional.",
        details: error.message,
      });
    }
  };
  