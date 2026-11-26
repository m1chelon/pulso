import { exercicios } from "./catalogo.js";
import { diaLocal } from "./diario.js";
import {
  dataCivil, dataDoCalendario, diasDoMes, estadoExercicio, resultadoDoTreino, tituloDoMes, treinosDoDia,
} from "./agenda.js";

const textoEstado = { feito: "Feito", "nao-feito": "Não feito", parcial: "Parcial", pendente: "Pendente" };
const simboloEstado = { feito: "✓", "nao-feito": "×", parcial: "◐", pendente: "•" };
const semana = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function resumoTreino(agenda, item) {
  const { feitos, total, estado } = resultadoDoTreino(agenda, item);
  return `<span class="pill status-${estado}"><span aria-hidden="true">${simboloEstado[estado]}</span> ${textoEstado[estado]}</span>
    <span class="check-progress">${feitos}/${total} feitos</span>`;
}

export function quadroCalendario(agenda, sessoes, mes, selecionado) {
  const hoje = diaLocal(new Date());
  const dias = diasDoMes(mes).map((chave) => {
    const data = dataCivil(chave);
    const doMes = data.getMonth() === mes.getMonth();
    const treinos = treinosDoDia(agenda, chave, sessoes);
    const marcadores = treinos.map((treino) => resultadoDoTreino(agenda, treino).estado);
    const nomes = treinos.map((treino, i) => `${treino.treino.nome} (${textoEstado[marcadores[i]]})`);
    const label = [dataDoCalendario(chave), ...nomes].join(", ");
    return `<button class="calendar-date${doMes ? "" : " outside-month"}" type="button"
        data-action="calendar-day" data-date="${chave}" aria-pressed="${chave === selecionado}"
        ${chave === hoje ? 'aria-current="date"' : ""} aria-label="${label}">
      <span class="date-number">${data.getDate()}</span>
      <span class="day-marks" aria-hidden="true">${marcadores.slice(0, 3).map((estado) =>
        `<span class="day-mark status-${estado}">${simboloEstado[estado]}</span>`).join("")}</span>
    </button>`;
  }).join("");
  return `<section class="panel calendar-panel" aria-labelledby="calendar-month">
    <div class="calendar-header">
      <h2 id="calendar-month">${tituloDoMes(mes)}</h2>
      <div class="calendar-controls">
        <button type="button" class="glass-button" data-action="calendar-prev" aria-label="Mês anterior">‹</button>
        <button type="button" class="glass-button" data-action="calendar-today">Hoje</button>
        <button type="button" class="glass-button" data-action="calendar-next" aria-label="Próximo mês">›</button>
      </div>
    </div>
    <div class="calendar-grid">${semana.map((dia) => `<span class="calendar-weekday" aria-hidden="true">${dia}</span>`).join("")}${dias}</div>
  </section>`;
}

export function painelChecklist(agenda, item) {
  const cabecalho = `<div class="section-heading">
    <div><h3>${item.treino.nome}</h3><p>${item.treino.descricao}</p></div>
    <div class="check-state">${resumoTreino(agenda, item)}</div>
  </div>`;
  const lista = item.exercicios.map((id) => {
    const e = exercicios[id];
    const estado = estadoExercicio(agenda, item, id);
    return `<li class="check-row">
      <button type="button" class="check-exercise" data-action="guide" data-id="${id}">
        <img src="./assets/photos/${e.fotos[0]}" alt="" width="52" height="42" loading="lazy">
        <strong>${e.nome}</strong>
      </button>
      <div class="check-controls" role="group" aria-label="Checklist de ${e.nome}">
        <button class="mark-button status-feito" type="button" data-action="mark-exercise" data-slot="${item.chave}"
          data-id="${id}" data-mark="feito" aria-pressed="${estado === "feito"}">${estado === "feito" ? '<span aria-hidden="true">✓</span> ' : ""}Fiz</button>
        <button class="mark-button status-nao-feito" type="button" data-action="mark-exercise" data-slot="${item.chave}"
          data-id="${id}" data-mark="nao-feito" aria-pressed="${estado === "nao-feito"}">${estado === "nao-feito" ? '<span aria-hidden="true">×</span> ' : ""}Não fiz</button>
      </div>
    </li>`;
  }).join("");
  return `<article class="panel checklist" data-checklist="${item.chave}">
    ${cabecalho}
    <div class="check-tools" aria-label="Ações do treino">
      <button type="button" class="primary" data-action="start" data-slot="${item.chave}">
        ${item.sessao?.fim ? "Ver sessão" : item.sessao ? "Retomar treino" : "Iniciar treino"}
      </button>
      ${item.sessao ? "" : `<button type="button" class="secondary" data-action="move-day" data-slot="${item.chave}">Mover treino</button>
        <button type="button" class="secondary" data-action="organize" data-slot="${item.chave}">Organizar exercícios</button>`}
    </div>
    <div class="checklist-title"><h4>Checklist</h4><span>Toque para marcar ou desmarcar</span></div>
    <ul>${lista}</ul>
    <div class="check-tools bulk-tools">
      <button type="button" class="glass-button" data-action="mark-workout" data-slot="${item.chave}" data-mark="feito">Fiz tudo</button>
      <button type="button" class="glass-button" data-action="mark-workout" data-slot="${item.chave}" data-mark="nao-feito">Não fiz o treino</button>
    </div>
  </article>`;
}

export function listaOrganizador(item) {
  return `<ol class="organizer-list">${item.exercicios.map((id, i) => {
    const nome = exercicios[id].nome;
    return `<li><span>${nome}</span><div class="organizer-controls">
      <button type="button" class="glass-button" data-action="reorder" data-slot="${item.chave}" data-id="${id}" data-direction="-1"
        aria-label="Subir ${nome}"${i === 0 ? " disabled" : ""}>↑</button>
      <button type="button" class="glass-button" data-action="reorder" data-slot="${item.chave}" data-id="${id}" data-direction="1"
        aria-label="Descer ${nome}"${i + 1 === item.exercicios.length ? " disabled" : ""}>↓</button>
      <button type="button" class="glass-button transfer-button" data-action="move-exercise" data-slot="${item.chave}" data-id="${id}"
        aria-label="Mover ${nome} para outro treino"${item.exercicios.length < 2 ? " disabled" : ""}>Mover</button>
    </div></li>`;
  }).join("")}</ol>`;
}
