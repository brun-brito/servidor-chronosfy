const { db, admin } = require("../config/firebase");

exports.createCliente = async (req, res) => {
  try {
    const { id_empresa } = req.params;
    const requiredFields = ["nome", "cpf", "email", "telefone"];
    const data = req.body;

    // Verificar campos obrigatórios
    const missingFields = requiredFields.filter((field) => !data[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `Os seguintes campos estão faltando: ${missingFields.join(", ")}`,
      });
    }

    // Criar cliente no Firestore
    const docRef = await db
      .collection("profissionais")
      .doc(id_empresa)
      .collection("clientes")
      .add({
        nome: data.nome,
        cpf: data.cpf,
        email: data.email,
        telefone: data.telefone,
      });

    res.status(201).json({
      message: "Cliente criado com sucesso!",
      id: docRef.id,
    });
  } catch (error) {
    res.status(500).json({
      error: "Erro ao criar cliente.",
      details: error.message,
    });
  }
};

exports.getAllClientes = async (req, res) => {
    try {
      const { id_empresa } = req.params;
  
      // Obter todos os clientes da empresa
      const snapshot = await db
        .collection("profissionais")
        .doc(id_empresa)
        .collection("clientes")
        .get();
  
      const clientes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
  
      res.status(200).json(clientes);
    } catch (error) {
      res.status(500).json({
        error: "Erro ao listar clientes.",
        details: error.message,
      });
    }
  };

  exports.getClienteById = async (req, res) => {
    try {
      const { id_empresa, id_cliente } = req.params;
  
      // Obter cliente pelo ID
      const docRef = db
        .collection("profissionais")
        .doc(id_empresa)
        .collection("clientes")
        .doc(id_cliente);
  
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Cliente não encontrado." });
      }
  
      res.status(200).json({ id: doc.id, ...doc.data() });
    } catch (error) {
      res.status(500).json({
        error: "Erro ao obter cliente.",
        details: error.message,
      });
    }
  };

  exports.updateCliente = async (req, res) => {
    try {
      const { id_empresa, id_cliente } = req.params;
      const validFields = ["nome", "cpf", "email", "telefone"]; // Campos permitidos
      const updates = req.body;
  
      // Verificar se o cliente existe
      const docRef = db
        .collection("profissionais")
        .doc(id_empresa)
        .collection("clientes")
        .doc(id_cliente);
  
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Cliente não encontrado." });
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
  
      // Atualizar cliente no Firestore
      await docRef.update(filteredUpdates);
  
      res.status(200).json({
        message: "Cliente atualizado com sucesso.",
        updatedFields: filteredUpdates,
      });
    } catch (error) {
      res.status(500).json({
        error: "Erro ao atualizar cliente.",
        details: error.message,
      });
    }
  };

  exports.deleteCliente = async (req, res) => {
    try {
      const { id_empresa, id_cliente } = req.params;
  
      // Verificar se o cliente existe
      const docRef = db
        .collection("profissionais")
        .doc(id_empresa)
        .collection("clientes")
        .doc(id_cliente);
  
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Cliente não encontrado." });
      }
  
      // Excluir cliente
      await docRef.delete();
  
      res.status(200).json({ message: "Cliente excluído com sucesso." });
    } catch (error) {
      res.status(500).json({
        error: "Erro ao excluir cliente.",
        details: error.message,
      });
    }
  };
  