const express = require('express');
const cors = require('cors');
const profissionalRoutes = require("./routes/profissionalRoutes");

const app = express();
const PORT = process.env.PORT || 8080

app.use(cors());
app.use(express.json());

app.use("/v1/profissional", profissionalRoutes);

// Rota padrão
app.get("/v1/", (req, res) => {
  res.send("API funcionando!");
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});