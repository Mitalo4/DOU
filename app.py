import requests
import re
from bs4 import BeautifulSoup
from datetime import datetime
from flask import Flask, jsonify, render_template

app = Flask(__name__, template_folder="templates")

# Palavra-chave exata
PALAVRA_CHAVE = "CARF"

# Configurações de requisição
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def buscar_no_dou():
    """Busca artigos no DOU contendo a palavra exata 'CARF'."""
    data = "13-02-2025"
    url_base = "https://www.in.gov.br/leiturajornal"
    secoes = ["do1", "do2"]

    links_encontrados = set()  # Evitar duplicatas

    print(f"🔍 Buscando artigos com '{PALAVRA_CHAVE}' no DOU de {data}...")

    for secao in secoes:
        link_secao = f"{url_base}?data={data}&secao={secao}"
        print(f"📌 Acessando {secao.upper()}...")

        try:
            response_secao = requests.get(link_secao, headers=HEADERS)
            response_secao.raise_for_status()

            # Encontrar links dos artigos no JSON da página
            pattern = r'"urlTitle":"([^"]+)"'
            artigos = re.findall(pattern, response_secao.text)

            for artigo in artigos:
                link_artigo_completo = f"https://www.in.gov.br/web/dou/-/{artigo}"

                # Acessar o artigo e verificar se contém "CARF"
                try:
                    response_artigo = requests.get(link_artigo_completo, headers=HEADERS)
                    response_artigo.raise_for_status()
                    soup_artigo = BeautifulSoup(response_artigo.text, 'html.parser')
                    texto_artigo = soup_artigo.get_text()

                    if re.search(PALAVRA_CHAVE, texto_artigo, re.IGNORECASE):
                        print(f"✅ Encontrado: {link_artigo_completo}")
                        links_encontrados.add(link_artigo_completo)

                except requests.exceptions.RequestException as e:
                    print(f"⚠️ Erro ao acessar artigo: {e}")
                    continue

        except requests.exceptions.RequestException as e:
            print(f"❌ Erro ao acessar seção {secao.upper()}: {e}")
            continue

    return list(links_encontrados)

@app.route("/", methods=["GET"])
def index():
    """Exibe a página HTML inicial."""
    return render_template("index.html")

@app.route("/buscar", methods=["GET"])
def buscar():
    """Executa a busca automaticamente e retorna os links encontrados."""
    links = buscar_no_dou()
    return jsonify({"data": datetime.today().strftime("%d-%m-%Y"), "links_encontrados": links})

if __name__ == "__main__":
    app.run(debug=True)
