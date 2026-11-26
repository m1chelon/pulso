import { exercicios, plano } from "./catalogo.js";
import { diaLocal } from "./diario.js";

export const CHAVE_AGENDA = "pulso.agenda.v1";

const treinos = new Map(plano.map((treino) => [treino.id, treino]));
const estados = ["feito", "nao-feito"];
const dataValida = /^\d{4}-\d{2}-\d{2}$/;
const diaFormatado = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const mesFormatado = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

export const novaAgenda = () => ({ destinos: {}, exercicios: {}, marcas: {} });
export const chaveDoTreino = (dia, id) => `${dia}/${id}`;
export const dataCivil = (chave) => new Date(chave + "T12:00:00");
export const dataDoCalendario = (chave) => diaFormatado.format(dataCivil(chave));
export const tituloDoMes = (data) => mesFormatado.format(data);

export function somarDias(chave, dias) {
  const data = dataCivil(chave);
  data.setDate(data.getDate() + dias);
  return diaLocal(data);
}

export function diasDoMes(mes) {
  const primeiro = diaLocal(new Date(mes.getFullYear(), mes.getMonth(), 1, 12));
  const ultimo = new Date(mes.getFullYear(), mes.getMonth() + 1, 0, 12).getDate();
  const inicio = (dataCivil(primeiro).getDay() + 6) % 7;
  return Array.from({ length: Math.ceil((inicio + ultimo) / 7) * 7 },
    (_, i) => somarDias(primeiro, i - inicio));
}

export function identificadorDeSessao(sessao) {
  return sessao.ocorrenciaId ?? chaveDoTreino(diaLocal(new Date(sessao.inicio)), sessao.treinoId);
}

export function sessaoDaOcorrencia(sessoes, chave) {
  return sessoes.findLast((sessao) => identificadorDeSessao(sessao) === chave);
}

export function ocorrencia(agenda, chave, sessoes = []) {
  const [original, id] = chave.split("/");
  const treino = treinos.get(id);
  if (!treino || !dataValida.test(original)) return null;
  const sessao = sessaoDaOcorrencia(sessoes, chave);
  const data = sessao?.diaPlanejado ?? agenda.destinos[chave] ?? original;
  const lista = sessao?.exercicios ?? agenda.exercicios[chave] ?? treino.exercicios;
  return { chave, data, treino, exercicios: lista, sessao };
}

export function treinosDoDia(agenda, chave, sessoes = []) {
  const ids = new Set(plano
    .filter((treino) => treino.dia === dataCivil(chave).getDay())
    .map((treino) => chaveDoTreino(chave, treino.id)));

  for (const [id, destino] of Object.entries(agenda.destinos)) {
    if (destino === chave) ids.add(id);
  }
  for (const sessao of sessoes) {
    const id = identificadorDeSessao(sessao);
    if ((sessao.diaPlanejado ?? id.split("/")[0]) === chave) ids.add(id);
  }
  return [...ids].map((id) => ocorrencia(agenda, id, sessoes)).filter((item) => item?.data === chave);
}

export function proximosTreinos(agenda, de, quantidadeDias, sessoes) {
  return Array.from({ length: quantidadeDias }, (_, indice) => treinosDoDia(agenda, somarDias(de, indice), sessoes))
    .flat();
}

export function estadoExercicio(agenda, treino, id) {
  const manual = agenda.marcas[treino.chave]?.[id];
  if (manual) return manual === "pendente" ? null : manual;
  const registros = treino.sessao?.registros[id] ?? [];
  if (registros.length >= exercicios[id].series || (treino.sessao?.fim && registros.length > 0)) {
    return "feito";
  }
  return null;
}

export function resultadoDoTreino(agenda, treino) {
  const lista = treino.exercicios.map((id) => estadoExercicio(agenda, treino, id));
  const feitos = lista.filter((estado) => estado === "feito").length;
  const pulados = lista.filter((estado) => estado === "nao-feito").length;
  const estado = feitos === lista.length ? "feito"
    : pulados === lista.length ? "nao-feito" : feitos + pulados > 0 ? "parcial" : "pendente";
  return { feitos, total: lista.length, estado };
}

export function marcarExercicio(agenda, treino, id, estado) {
  if (!treino.exercicios.includes(id) || !estados.includes(estado)) return false;
  const marcas = agenda.marcas[treino.chave] ??= {};
  const anterior = estadoExercicio(agenda, treino, id);
  marcas[id] = anterior === estado ? "pendente" : estado;
  return true;
}

export function marcarTreino(agenda, treino, estado) {
  if (!estados.includes(estado)) return false;
  agenda.marcas[treino.chave] = Object.fromEntries(treino.exercicios.map((id) => [id, estado]));
  return true;
}

export function moverTreino(agenda, treino, destino) {
  if (treino.sessao || !dataValida.test(destino) || destino === treino.data) return false;
  if (destino === treino.chave.split("/")[0]) delete agenda.destinos[treino.chave];
  else agenda.destinos[treino.chave] = destino;
  return true;
}

export function reordenar(agenda, treino, id, direcao) {
  const indice = treino.exercicios.indexOf(id);
  const posicao = indice + direcao;
  if (treino.sessao || indice < 0 || Math.abs(direcao) !== 1 || posicao < 0 || posicao >= treino.exercicios.length) return false;
  const lista = [...treino.exercicios];
  [lista[indice], lista[posicao]] = [lista[posicao], lista[indice]];
  agenda.exercicios[treino.chave] = lista;
  return true;
}

export function transferirExercicio(agenda, de, para, id) {
  if (de.sessao || para.sessao || de.exercicios.length < 2 || !de.exercicios.includes(id) || para.exercicios.includes(id)) return false;
  agenda.exercicios[de.chave] = de.exercicios.filter((exercicio) => exercicio !== id);
  agenda.exercicios[para.chave] = [...para.exercicios, id];
  const estado = agenda.marcas[de.chave]?.[id];
  if (estado) {
    (agenda.marcas[para.chave] ??= {})[id] = estado;
    delete agenda.marcas[de.chave][id];
  }
  return true;
}

export function lerAgenda(storage) {
  const salvo = storage.getItem(CHAVE_AGENDA);
  if (!salvo) return novaAgenda();
  const agenda = JSON.parse(salvo);
  if (!agenda || !["destinos", "exercicios", "marcas"].every((campo) => objeto(agenda[campo]))) {
    throw new Error("Agenda em formato inválido");
  }
  for (const [chave, data] of Object.entries(agenda.destinos)) {
    if (!chaveValida(chave) || typeof data !== "string" || !dataValida.test(data)) throw new Error("Remanejamento inválido");
  }
  for (const [chave, lista] of Object.entries(agenda.exercicios)) {
    if (!chaveValida(chave) || !listaValida(lista)) throw new Error("Treino inválido");
  }
  for (const [chave, marcas] of Object.entries(agenda.marcas)) {
    if (!chaveValida(chave) || !objeto(marcas)
      || Object.entries(marcas).some(([id, estado]) => !Object.hasOwn(exercicios, id) || !estados.includes(estado) && estado !== "pendente")) {
      throw new Error("Checklist inválido");
    }
  }
  return agenda;
}

export function salvarAgenda(storage, agenda) {
  storage.setItem(CHAVE_AGENDA, JSON.stringify(agenda));
}

export function listaValida(lista) {
  return Array.isArray(lista) && lista.length > 0 && new Set(lista).size === lista.length
    && lista.every((id) => typeof id === "string" && Object.hasOwn(exercicios, id));
}

export function chaveValida(chave) {
  if (typeof chave !== "string") return false;
  const partes = chave.split("/");
  return partes.length === 2 && dataValida.test(partes[0]) && treinos.has(partes[1]);
}

function objeto(valor) {
  return valor && typeof valor === "object" && !Array.isArray(valor);
}
