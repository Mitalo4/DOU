const express = require("express");
const axios = require("axios");
const fs = require("fs");
const cron = require("node-cron");

const app = express();
const PORT = process.env.PORT || 3000;

const SECOES = ["do1", "do2"];
const BASE_URL = "https://www.in.gov.br/leiturajornal";
const TERMOS_INTERESSE = ["Conselho Administrativo de Recursos Fiscais", "Receita Federal", "CARF"];
const DATA_JSON = "resultados.json";

// Função para obter a data no formato brasileiro (DD-MM-YYYY)
function obterDataBrasil() {
  const agora = new Date();
  const offsetBrasil = -3 * 60;
  const offsetLocal = agora.getTimezoneOffset();
  const diferenca = offsetBrasil - offsetLocal;
  const dataBrasil = new Date(agora.getTime() + diferenca * 60000);
  return dataBrasil.toISOString().split("T")[0].split("-").reverse().join("-");
}

// Função principal para buscar artigos e armazenar os resultados
async function buscarArtigos() {
  const data = obterDataBrasil();
  console.log(`[${new Date().toLocaleTimeString()}] Buscando artigos para ${data}...`);

  let resultados = { data, artigos: [] };

  for (const secao of SECOES) {
    const urlSecao = `${BASE_URL}?data=${data}&secao=${secao}`;

    try {
      const resSecao = await axios.get(urlSecao);
      const htmlSecao = resSecao.data;

      const regex = /"urlTitle":"([^"]+)"/g;
      let match;

      while ((match = regex.exec(htmlSecao)) !== null) {
        const linkArtigo = `https://www.in.gov.br/web/dou/-/${match[1]}`;
        const resArtigo = await axios.get(linkArtigo);
        const htmlArtigo = resArtigo.data;

        // Verifica se o artigo contém pelo menos um dos termos de interesse
        const contemTermo = TERMOS_INTERESSE.some(termo => new RegExp(termo, "i").test(htmlArtigo));
        if (!contemTermo) continue;

        // Captura o título do artigo
        let identificaMatch = htmlArtigo.match(/<p class="identifica">(.*?)<\/p>/);
        let titulo = identificaMatch ? identificaMatch[1].trim() : "Título não encontrado";

        // Captura a data de publicação
        let dataMatch = htmlArtigo.match(/<span class="publicado-dou-data">(.*?)<\/span>/);
        let dataPublicacao = dataMatch ? dataMatch[1].trim() : "Data não disponível";

        // Captura o conteúdo do artigo
        let textoMatch = htmlArtigo.match(/<div class="texto-dou">([\s\S]*?)<\/div>/);
        let textoCompleto = textoMatch ? textoMatch[1].replace(/<\/?[^>]+(>|$)/g, "").trim() : "Texto não disponível.";

        resultados.artigos.push({
          titulo,
          dataPublicacao,
          link: linkArtigo,
          resumo: textoCompleto
        });
      }
    } catch (erro) {
      console.error(`Erro ao acessar seção ${secao}: ${erro.message}`);
    }
  }

  fs.writeFileSync(DATA_JSON, JSON.stringify(resultados, null, 2));
  console.log(`✅ Dados atualizados em ${DATA_JSON}`);
}

// ** Agendar a execução diária às 06:00 da manhã **
cron.schedule("0 6 * * *", () => {
  console.log("⏳ Executando busca programada...");
  buscarArtigos();
});

// ** Rota para exibir os artigos armazenados **
app.get("/dou", (req, res) => {
  if (fs.existsSync(DATA_JSON)) {
    const dados = fs.readFileSync(DATA_JSON);
    res.json(JSON.parse(dados));
  } else {
    res.status(404).json({ mensagem: "Dados ainda não disponíveis." });
  }
});

// ** Inicia o servidor **
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  buscarArtigos(); // Primeira execução ao iniciar
});
