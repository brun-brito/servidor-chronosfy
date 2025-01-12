const { db, admin } = require("../config/firebase");

exports.createCliente = async (req, res) => {
  try {
    const { id_empresa } = req.params;
    const requiredFields = ["nome", "cpf", "email", "telefone"];
    const data = req.body;

    // Verificar se é um array ou um único cliente
    const clientes = Array.isArray(data) ? data : [data];

    // Validar e processar cada cliente
    const results = [];
    for (const cliente of clientes) {
      // Verificar campos obrigatórios
      const missingFields = requiredFields.filter((field) => !cliente[field]);
      if (missingFields.length > 0) {
        return res.status(400).json({
          error: `Os seguintes campos estão faltando: ${missingFields.join(", ")}`,
          cliente: cliente.nome || cliente,
        });
      }

      // Verificar duplicidade de CPF, email ou telefone
      const clientesRef = db.collection("profissionais").doc(id_empresa).collection("clientes");

      const cpfSnapshot = await clientesRef.where("cpf", "==", cliente.cpf).get();
      if (!cpfSnapshot.empty) {
        return res.status(400).json({ error: `CPF já cadastrado: ${cliente.cpf}` });
      }

      const emailSnapshot = await clientesRef.where("email", "==", cliente.email).get();
      if (!emailSnapshot.empty) {
        return res.status(400).json({ error: `E-mail já cadastrado: ${cliente.email}` });
      }

      const telefoneSnapshot = await clientesRef.where("telefone", "==", cliente.telefone).get();
      if (!telefoneSnapshot.empty) {
        return res.status(400).json({ error: `Telefone já cadastrado: ${cliente.telefone}` });
      }

      // Criar cliente no Firestore
      const docRef = await clientesRef.add({
        nome: cliente.nome,
        cpf: cliente.cpf,
        email: cliente.email,
        telefone: cliente.telefone,
      });

      results.push({ message: "Cliente criado com sucesso!", id: docRef.id });
    }

    res.status(201).json({
      message: "Clientes criados com sucesso!",
      results,
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
      const { nome } = req.query; // Captura o parâmetro 'nome' da query string

      // Função para normalizar strings (remover acentos e converter para lowercase)
      const normalizeString = (str) =>
        str
          ?.toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, ""); // Remove os diacríticos (acentos)

      // Obter todos os clientes da empresa
      const snapshot = await db
        .collection("profissionais")
        .doc(id_empresa)
        .collection("clientes")
        .get();

      let clientes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Se o parâmetro 'nome' for fornecido, filtra os resultados
      if (nome) {
        const nomeNormalized = normalizeString(nome); // Normaliza o valor de busca
        clientes = clientes.filter((cliente) => {
          const clienteNomeNormalized = normalizeString(cliente.nome); // Normaliza o nome do cliente
          return clienteNomeNormalized?.includes(nomeNormalized); // Busca insensível a case e acentos
        });
      }

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
  
      // Verificar duplicidade de CPF, email ou telefone (se forem enviados)
      const clientesRef = db.collection("profissionais").doc(id_empresa).collection("clientes");
  
      if (updates.cpf) {
        const snapshot = await clientesRef.where("cpf", "==", updates.cpf).get();
        if (!snapshot.empty && snapshot.docs[0].id !== id_cliente) {
          return res.status(400).json({ error: "CPF já cadastrado." });
        }
      }
  
      if (updates.email) {
        const snapshot = await clientesRef.where("email", "==", updates.email).get();
        if (!snapshot.empty && snapshot.docs[0].id !== id_cliente) {
          return res.status(400).json({ error: "E-mail já cadastrado." });
        }
      }
  
      if (updates.telefone) {
        const snapshot = await clientesRef.where("telefone", "==", updates.telefone).get();
        if (!snapshot.empty && snapshot.docs[0].id !== id_cliente) {
          return res.status(400).json({ error: "Telefone já cadastrado." });
        }
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
  