export const CHAVE = "pulso.diario.v1";

export const dias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const dataDaSessao = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" });
const dataDeHoje = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const numero = new Intl.NumberFormat("pt-BR", { useGrouping: false, maximumFractionDigits: 3 });

export const dataCurta = (iso) => dataDaSessao.format(new Date(iso));
export const dataLonga = (data) => dataDeHoje.format(data);
export const cargaFormatada = (carga) => numero.format(carga);

export function diaLocal(data) {
  return [data.getFullYear(), data.getMonth() + 1, data.getDate()]
    .map((parte) => String(parte).padStart(2, "0"))
    .join("-");
}

export function treinoDoDia(plano, agora) {
  return plano.find((treino) => treino.dia === agora.getDay());
}

export function proximoTreino(plano, agora) {
  const dia = agora.getDay();
  for (let distancia = 1; distancia <= 7; distancia++) {
    const treino = plano.find((diaDoTreino) => diaDoTreino.dia === (dia + distancia) % 7);
    if (treino) return treino;
  }
}

export function sessaoAtual(sessoes, treinoId, agora) {
  const recentes = [...sessoes].reverse().filter((sessao) => sessao.treinoId === treinoId);
  return recentes.find((sessao) => !sessao.fim)
    ?? recentes.find((sessao) => diaLocal(new Date(sessao.fim)) === diaLocal(agora));
}

export function criarSessao(treinoId, agora) {
  return { id: crypto.randomUUID(), treinoId, inicio: agora.toISOString(), fim: null, registros: {} };
}

export function totalRegistrado(sessao) {
  return Object.values(sessao.registros).reduce((total, series) => total + series.length, 0);
}

export function ultimaCarga(sessoes, sessao, exercicio) {
  const nessaSessao = sessao.registros[exercicio]?.at(-1)?.carga;
  if (nessaSessao != null) return nessaSessao;

  for (const anterior of [...sessoes].reverse()) {
    const carga = anterior.registros[exercicio]?.at(-1)?.carga;
    if (anterior.fim && carga != null) return carga;
  }
}

export function lerSerie(quantidade, carga) {
  const valor = quantidade.trim();
  const peso = carga.trim();
  if (!/^\d+$/.test(valor) || !Number.isSafeInteger(Number(valor)) || Number(valor) <= 0) {
    return { erro: "Informe um número inteiro maior que zero." };
  }
  if (peso && (!/^\d+([,.]\d{1,3})?$/.test(peso) || !Number.isFinite(Number(peso.replace(",", "."))))) {
    return { erro: "Informe uma carga válida, como 12,5 kg." };
  }
  return { quantidade: Number(valor), carga: peso ? Number(peso.replace(",", ".")) : null };
}

export function lerDiario(storage) {
  const valor = storage.getItem(CHAVE);
  if (valor === null) return [];
  const sessoes = JSON.parse(valor);
  if (!Array.isArray(sessoes) || sessoes.some((item) => !sessaoValida(item))) {
    throw new Error("Diário em formato inválido");
  }
  return sessoes;
}

export function salvarDiario(storage, sessoes) {
  storage.setItem(CHAVE, JSON.stringify(sessoes));
}

function sessaoValida(item) {
  return item && typeof item.id === "string" && /^[0-9a-f-]{36}$/i.test(item.id) && typeof item.treinoId === "string"
    && Number.isFinite(Date.parse(item.inicio)) && (item.fim === null || Number.isFinite(Date.parse(item.fim)))
    && item.registros && !Array.isArray(item.registros) && typeof item.registros === "object"
    && Object.values(item.registros).every((series) => Array.isArray(series) && series.every(serieValida));
}

function serieValida(serie) {
  return serie && Number.isInteger(serie.numero) && serie.numero > 0
    && Number.isSafeInteger(serie.quantidade) && serie.quantidade > 0
    && (serie.carga === null || (Number.isFinite(serie.carga) && serie.carga >= 0));
}
