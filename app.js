import { exercicios, plano } from "./catalogo.js";
import {
  CHAVE, cargaFormatada, criarSessao, dataCurta, dataLonga, diaLocal, lerDiario,
  lerSerie, salvarDiario, totalRegistrado, ultimaCarga,
} from "./diario.js";

import {
  CHAVE_AGENDA, chaveValida, dataCivil, dataDoCalendario, identificadorDeSessao, lerAgenda, listaValida,
  marcarExercicio, marcarTreino, moverTreino, novaAgenda, ocorrencia, proximosTreinos, reordenar,
  salvarAgenda, somarDias, transferirExercicio, treinosDoDia,
} from "./agenda.js";
import { listaOrganizador, painelChecklist, quadroCalendario, resumoTreino } from "./calendario.js";

const main = document.querySelector("#main");
const modal = document.querySelector("#modal");
const status = document.querySelector("#status");
const porId = new Map(plano.map((treino) => [treino.id, treino]));
let sessoes = [];
let agenda = novaAgenda();
let erroLeitura = false;
let erroAgenda = false;
let dataSelecionada = diaLocal(new Date());
let mesCalendario = dataCivil(dataSelecionada);
let erroGravacao = false;
let selecionado;
let renderizacaoPendente = false;
let focoAposFechar;

function carregar() {
  try {
    sessoes = lerDiario(localStorage);
    erroLeitura = false;
  } catch {
    erroLeitura = true;
  }
  try {
    agenda = lerAgenda(localStorage);
    erroAgenda = false;
  } catch {
    erroAgenda = true;
  }
}

function anunciar(mensagem) {
  status.textContent = mensagem;
}

async function transacionar(executar) {
  try {
    return await (navigator.locks ? navigator.locks.request(CHAVE, executar) : executar());
  } catch {
    erroGravacao = true;
    const aviso = modal.open ? modal.querySelector("[data-erro]") : null;
    if (aviso) aviso.textContent = "O navegador não conseguiu salvar. Tente novamente.";
    else renderizar();
    return null;
  }
}

function modificar(operacao) {
  return transacionar(() => {
    const atuais = lerDiario(localStorage);
    const resultado = operacao(atuais);
    if (resultado !== false) salvarDiario(localStorage, atuais);
    sessoes = atuais;
    erroLeitura = erroGravacao = false;
    return resultado;
  });
}

async function modificarAgenda(operacao, mensagem) {
  const ok = await transacionar(() => {
    const atual = lerAgenda(localStorage);
    const registros = lerDiario(localStorage);
    const alterado = operacao(atual, registros);
    if (alterado) salvarAgenda(localStorage, atual);
    agenda = atual;
    sessoes = registros;
    erroAgenda = erroLeitura = erroGravacao = false;
    return alterado;
  });
  if (ok) anunciar(mensagem);
  else if (ok === false) {
    const aviso = modal.open ? modal.querySelector("[data-erro]") : null;
    if (aviso) aviso.textContent = "Esse remanejamento não está mais disponível.";
    else anunciar("O treino foi atualizado em outra aba.");
  }
  return ok;
}

function avisoDiario() {
  if (!erroLeitura && !erroAgenda && !erroGravacao) return "";
  const mensagem = erroLeitura ? "O diário local está indisponível." : erroAgenda
    ? "O calendário local está indisponível." : "O navegador não conseguiu salvar a alteração.";
  return `<p class="warning" role="alert">${mensagem} Recarregue a página para tentar novamente.</p>`;
}

function objetivo(e) {
  return `${e.series} × ${e.min}–${e.max} ${e.unidade}`;
}

function contagem(treino) {
  return treino.exercicios.reduce((total, chave) => total + exercicios[chave].series, 0);
}

function foto(e, i = 0) {
  return "./assets/photos/" + e.fotos[i];
}

function botaoSessao(item) {
  const texto = item.sessao?.fim ? "Ver sessão" : item.sessao ? "Retomar treino" : "Iniciar treino";
  return `<button class="primary" type="button" data-action="start" data-slot="${item.chave}">${texto}</button>`;
}

function dadosDaSessao(sessao) {
  const base = porId.get(sessao.treinoId);
  return { ...base, exercicios: listaValida(sessao.exercicios) ? sessao.exercicios : base.exercicios };
}

function cabecalho(titulo, detalhe) {
  return `<div class="page-title">
    <h1 id="title" tabindex="-1">${titulo}</h1>
    ${detalhe ? `<p>${detalhe}</p>` : ""}
  </div>`;
}

function listaPlano(treino) {
  return treino.exercicios.map((id) => {
    const e = exercicios[id];
    return `<li><button type="button" class="exercise" data-action="guide" data-id="${id}">
      <img src="${foto(e)}" alt="" width="76" height="60" loading="lazy">
      <span class="exercise-text"><strong>${e.nome}</strong><small>${objetivo(e)}</small></span>
      <span class="chevron" aria-hidden="true">›</span>
    </button></li>`;
  }).join("");
}

function telaTreino() {
  const agora = new Date();
  const hoje = diaLocal(agora);
  const segunda = somarDias(hoje, -((agora.getDay() + 6) % 7));
  const pendente = sessoes.findLast((sessao) => !sessao.fim && porId.has(sessao.treinoId));
  const semana = proximosTreinos(agenda, segunda, 7, sessoes);
  const proximos = proximosTreinos(agenda, hoje, 15, sessoes);
  const item = (selecionado && ocorrencia(agenda, selecionado, sessoes))
    || (pendente && ocorrencia(agenda, identificadorDeSessao(pendente), sessoes))
    || proximos[0];
  const rotulo = item && (item.sessao?.fim ? "Sessão concluída" : item.sessao ? "Em andamento"
    : item.data === hoje ? "Treino de hoje" : selecionado ? dataDoCalendario(item.data) : "Próximo treino");
  const diasDaSemana = semana.map((dia) => `<li>
    <button class="week-day" type="button" data-action="day" data-slot="${dia.chave}" aria-pressed="${dia.chave === item?.chave}">
      <span><small>${dataDoCalendario(dia.data)}</small><strong>${dia.treino.nome}</strong></span>
      <span class="chevron" aria-hidden="true">›</span>
    </button>
  </li>`).join("");

  return `${cabecalho("Seu treino", dataLonga(agora))}
    ${avisoDiario()}
    <section class="hero" aria-labelledby="treino-destaque">
      <div class="hero-content">
        ${item ? `<p class="hero-state">${rotulo}</p>
          <h2 id="treino-destaque">${item.treino.nome}</h2>
          <p class="hero-description">${item.treino.descricao}</p>
          <p class="hero-count">${item.exercicios.length} exercícios · ${contagem(item)} séries</p>
          <div class="hero-actions">${botaoSessao(item)}
            <button class="secondary" type="button" data-action="calendar" data-date="${item.data}">Checklist</button>
          </div>` : `<h2 id="treino-destaque">Dia de descanso</h2>
            <button class="primary" type="button" data-action="calendar">Abrir calendário</button>`}
      </div>
      <img class="hero-mascot" src="./assets/capivara.webp" alt="Capivara com faixa verde e um halter" width="320" height="320">
    </section>
    <div class="dashboard-grid">
      <section class="panel week" aria-labelledby="semana"><h2 id="semana">Plano semanal</h2>
        ${diasDaSemana ? `<ul>${diasDaSemana}</ul>` : '<p class="muted">Nenhum treino nesta semana.</p>'}
        <button class="glass-button calendar-link" type="button" data-action="calendar">Abrir calendário</button>
      </section>
      ${item ? `<section class="panel exercises" aria-labelledby="lista">
        <div class="section-heading"><h2 id="lista">Exercícios</h2><div class="check-state">${resumoTreino(agenda, item)}</div></div>
        <ul>${listaPlano(item)}</ul>
      </section>` : ""}
    </div>`;
}

function telaCalendario() {
  const itens = treinosDoDia(agenda, dataSelecionada, sessoes);
  return `${cabecalho("Calendário", "")}${avisoDiario()}
    <div class="calendar-layout">
      ${quadroCalendario(agenda, sessoes, mesCalendario, dataSelecionada)}
      <section class="calendar-detail" aria-labelledby="calendar-selection">
        <h2 id="calendar-selection">${dataDoCalendario(dataSelecionada)}</h2>
        ${itens.length ? itens.map((item) => painelChecklist(agenda, item)).join("")
          : '<p class="panel empty-day">Dia de descanso.</p>'}
      </section>
    </div>`;
}

function abrirCalendario(data) {
  if (data) {
    dataSelecionada = data;
    mesCalendario = dataCivil(data);
  }
  ir("#calendario");
}

function textoSeries(total) {
  return `${total} ${total === 1 ? "série" : "séries"}`;
}

function telaHistorico() {
  const finalizadas = sessoes.filter((s) => s.fim && porId.has(s.treinoId))
    .sort((a, b) => Date.parse(b.fim) - Date.parse(a.fim));
  const itens = finalizadas.map((sessao) => {
    const treino = porId.get(sessao.treinoId);
    return `<li><button class="week-day history-row" type="button" data-action="session" data-id="${sessao.id}">
      <span><strong>${treino.nome}</strong><small>${dataCurta(sessao.inicio)} · ${textoSeries(totalRegistrado(sessao))}</small></span>
      <span class="chevron" aria-hidden="true">›</span>
    </button></li>`;
  }).join("");

  return `${cabecalho("Histórico", "Consulte as cargas e repetições que você registrou.")}
    ${avisoDiario()}
    <section class="panel history">${itens ? `<ul>${itens}</ul>`
      : "<h2>Nenhum treino registrado</h2><p>Os treinos aparecem aqui quando você finaliza uma sessão.</p>"}</section>`;
}

function cartaoExercicio(chave, sessao) {
  const e = exercicios[chave];
  const series = sessao.registros[chave] ?? [];
  const numeros = sessao.fim ? series.map((serie) => serie.numero) : Array.from({length: e.series}, (_, i) => i + 1);
  const linhas = numeros.map((num) => {
    const serie = series.find((s) => s.numero === num);
    const resumo = serie ? `${serie.quantidade} ${e.unidade}${serie.carga == null ? "" : " · " + cargaFormatada(serie.carga) + " kg"}` : "Registrar";
    const conteudo = `<span>Série ${num}</span><span class="${serie ? "recorded" : "add"}">${resumo}
      <span aria-hidden="true">${serie ? "✓" : "+"}</span></span>`;
    return sessao.fim ? `<div class="set-row">${conteudo}</div>`
      : `<button type="button" class="set-row" data-action="edit" data-id="${chave}" data-number="${num}">
        ${conteudo}
      </button>`;
  }).join("");

  return `<article class="panel session-exercise">
    <button type="button" class="exercise" data-action="guide" data-id="${chave}">
      <img src="${foto(e)}" alt="" width="76" height="60" loading="lazy">
      <span class="exercise-text"><strong>${e.nome}</strong><small>Como fazer · ${objetivo(e)}</small></span>
      <span class="chevron" aria-hidden="true">›</span>
    </button>
    ${linhas || '<p class="no-sets">Nenhuma série registrada.</p>'}
  </article>`;
}

function telaSessao(sessao, treino) {
  const feitas = totalRegistrado(sessao);
  const total = contagem(treino);
  const dia = sessao.diaPlanejado ?? diaLocal(new Date(sessao.inicio));
  return `<button type="button" class="back" data-action="${sessao.fim ? "history" : "calendar"}" data-date="${dia}">‹ ${sessao.fim ? "Histórico" : "Calendário"}</button>
    ${cabecalho(treino.nome, dataCurta(sessao.inicio))}
    ${avisoDiario()}
    <section class="session-progress" aria-labelledby="progresso">
      <p id="progresso"><strong>${feitas} de ${total} séries</strong><span>${sessao.fim ? "Sessão finalizada" : "registradas"}</span></p>
      <progress value="${feitas}" max="${total}" aria-labelledby="progresso"></progress>
    </section>
    <div class="session-grid">${treino.exercicios.map((id) => cartaoExercicio(id, sessao)).join("")}</div>
    ${sessao.fim ? "" : `<div class="session-actions">
      ${feitas === 0 ? '<button type="button" class="secondary" data-action="discard">Descartar sessão vazia</button>' : ""}
      <button type="button" class="primary" data-action="finish"${feitas === 0 ? " disabled" : ""}>Finalizar sessão</button>
    </div>`}`;
}

function rota() {
  const hash = location.hash.slice(1);
  if (hash === "calendario") return { nome: "calendar" };
  if (hash === "historico") return { nome: "history" };
  if (hash.startsWith("sessao/")) {
    const sessao = sessoes.find((s) => s.id === hash.slice(7));
    if (sessao && porId.has(sessao.treinoId)) return { nome: "session", sessao };
  }
  return { nome: "home" };
}

function renderizar(foco = false) {
  if (modal.open) {
    renderizacaoPendente = true;
    return;
  }
  const atual = rota();
  if (atual.nome === "history") main.innerHTML = telaHistorico();
  else if (atual.nome === "calendar") main.innerHTML = telaCalendario();
  else if (atual.nome === "session") main.innerHTML = telaSessao(atual.sessao, dadosDaSessao(atual.sessao));
  else main.innerHTML = telaTreino();
  const abaAtual = atual.nome === "calendar" ? "calendar"
    : atual.nome === "history" || atual.sessao?.fim ? "history" : "home";
  for (const aba of document.querySelectorAll(".tabs button")) {
    if (aba.dataset.action === abaAtual) aba.setAttribute("aria-current", "page");
    else aba.removeAttribute("aria-current");
  }
  if (foco) {
    window.scrollTo(0, 0);
    document.querySelector("#title").focus({preventScroll: true});
  }
}

function ir(hash) {
  if (location.hash === hash) renderizar(true);
  else location.hash = hash;
}

function abrirModal(conteudo, classe = "") {
  if (!modal.open) focoAposFechar = document.activeElement;
  modal.className = classe;
  modal.innerHTML = conteudo;
  if (!modal.open) modal.showModal();
  else modal.querySelector(".close").focus();
  modal.scrollTop = 0;
}

function tituloModal(titulo, subtitulo) {
  return `<div class="modal-top"><div><h2 id="modal-title">${titulo}</h2>
    ${subtitulo ? `<p>${subtitulo}</p>` : ""}</div>
    <button type="button" class="close" data-action="close" aria-label="Fechar">×</button></div>`;
}

function guia(chave) {
  const e = exercicios[chave];
  const imagens = e.fotos.map((_, i) => {
    const legenda = e.unidade === "s" ? "Posição da prancha" : i === 0 ? "Posição inicial" : "Segunda posição";
    return `<figure><img src="${foto(e, i)}" alt="${legenda} de ${e.nome}" width="850" height="567">
      <figcaption>${legenda}</figcaption></figure>`;
  }).join("");
  abrirModal(`${tituloModal(e.nome, e.equipamento + " · " + objetivo(e))}
    <div class="photos">${imagens}</div>
    <h3>Como fazer</h3><ol class="steps">${e.passos.map((passo) => `<li>${passo}</li>`).join("")}</ol>
    <p class="credit"><a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noreferrer">Fotos do Free Exercise DB</a></p>`,
  "guide");
}

function editor(sessao, chave, numero) {
  const e = exercicios[chave];
  const serie = sessao.registros[chave]?.find((s) => s.numero === numero);
  const carga = serie ? serie.carga : ultimaCarga(sessoes, sessao, chave);
  const campo = e.unidade === "s" ? "Segundos" : "Repetições";
  abrirModal(`${tituloModal(`Série ${numero}`, e.nome)}
    <form id="editor" data-id="${chave}" data-number="${numero}">
      <label>${campo}<input name="quantidade" inputmode="numeric" autocomplete="off" value="${serie?.quantidade ?? ""}" required></label>
      ${e.unidade === "s" ? "" : `<label>Carga em kg <span>(opcional)</span>
        <input name="carga" inputmode="decimal" autocomplete="off" value="${carga == null ? "" : cargaFormatada(carga)}"></label>`}
      ${e.equipamento.toLowerCase().includes("halter") ? '<p class="form-note">Registre o peso de um halter.</p>' : ""}
      <p class="form-error" role="alert" data-erro></p>
      <button class="primary" type="submit">Salvar série</button>
      ${serie ? `<button class="secondary" type="button" data-action="remove" data-id="${chave}" data-number="${numero}">Remover registro</button>` : ""}
    </form>`, "editor");
}

function confirmarFim(sessao) {
  const total = totalRegistrado(sessao);
  abrirModal(`${tituloModal("Finalizar agora?", "")}
    <p>O histórico vai guardar a sessão com ${textoSeries(total)} ${total === 1 ? "registrada" : "registradas"}.</p>
    <p class="form-error" role="alert" data-erro></p>
    <button class="primary" type="button" data-action="finish-confirm">Finalizar sessão</button>
    <button class="secondary" type="button" data-action="close">Continuar treino</button>`);
}

async function alterarSessao(sessao, operacao, mensagem) {
  if (!sessao || sessao.fim) return false;
  const ok = await modificar((atuais) => {
    const indice = atuais.findIndex((item) => item.id === sessao.id && !item.fim);
    if (indice === -1) return false;
    return operacao(atuais[indice], atuais, indice) !== false;
  });
  if (!ok) {
    if (ok === false) {
      modal.close();
      renderizar();
      anunciar("A sessão foi alterada em outra aba.");
    }
    return false;
  }
  if (modal.open) modal.close();
  renderizar();
  anunciar(mensagem);
  return true;
}

function modalDeTreino(item) {
  abrirModal(`${tituloModal("Mover treino", item.treino.nome + " · " + dataDoCalendario(item.data))}
    <form class="agenda-form" data-form="move-day" data-slot="${item.chave}">
      <label>Nova data<input type="date" name="destino" value="${item.data}" required></label>
      <p class="form-note">Se a data já tiver um treino, os dois aparecem no calendário.</p>
      <p class="form-error" role="alert" data-erro></p>
      <button class="primary" type="submit">Salvar nova data</button>
    </form>`, "agenda-modal");
}

function organizar(item) {
  abrirModal(`${tituloModal("Organizar exercícios", item.treino.nome + " · " + dataDoCalendario(item.data))}
    ${listaOrganizador(item)}
    <p class="form-error" role="alert" data-erro></p>
    <button class="primary" type="button" data-action="close">Concluir</button>`, "agenda-modal organize-modal");
}

function modalDeExercicio(item, id) {
  const opcoes = proximosTreinos(agenda, somarDias(item.data, -7), 36, sessoes)
    .filter((alvo) => alvo.chave !== item.chave && !alvo.sessao && !alvo.exercicios.includes(id));
  abrirModal(`${tituloModal("Mover exercício", exercicios[id].nome)}
    <form class="agenda-form" data-form="move-exercise" data-slot="${item.chave}" data-id="${id}">
      ${opcoes.length ? `<label>Treino de destino<select name="destino" required>
        <option value="">Escolha um treino</option>
        ${opcoes.map((alvo) => `<option value="${alvo.chave}">${alvo.treino.nome} · ${dataDoCalendario(alvo.data)}</option>`).join("")}
      </select></label>
      <button class="primary" type="submit">Mover exercício</button>`
        : '<p class="form-note">Nenhum treino disponível neste período.</p>'}
      <p class="form-error" role="alert" data-erro></p>
    </form>
    <button class="secondary" type="button" data-action="organize" data-slot="${item.chave}">Voltar à lista</button>`, "agenda-modal");
}

function atualizarCalendario(action) {
  renderizar();
  main.querySelector(`[data-action="${action}"]`)?.focus({ preventScroll: true });
}

function recuperarSeletor(alvo) {
  const { action, slot, id, mark } = alvo.dataset;
  return `[data-action="${action}"][data-slot="${slot}"]`
    + (id ? `[data-id="${id}"]` : "") + (mark ? `[data-mark="${mark}"]` : "");
}

async function agirNoCalendario(action, alvo, item) {
  const { date, id, mark, slot, direction } = alvo.dataset;
  switch (action) {
    case "calendar": abrirCalendario(date); break;
    case "calendar-day":
      mesCalendario = dataCivil(date);
      dataSelecionada = date;
      renderizar();
      main.querySelector(`[data-action="calendar-day"][data-date="${date}"]`)?.focus({ preventScroll: true });
      anunciar(dataDoCalendario(date));
      break;
    case "calendar-prev":
    case "calendar-next":
      mesCalendario = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() + (action === "calendar-prev" ? -1 : 1), 1, 12);
      dataSelecionada = diaLocal(mesCalendario);
      atualizarCalendario(action);
      anunciar(main.querySelector("#calendar-month").textContent);
      break;
    case "calendar-today":
      dataSelecionada = diaLocal(new Date());
      mesCalendario = dataCivil(dataSelecionada);
      atualizarCalendario(action);
      anunciar(dataDoCalendario(dataSelecionada));
      break;
    case "mark-exercise":
    case "mark-workout": {
      if (!item) break;
      const marcou = await modificarAgenda((atual, registros) => {
        const treino = ocorrencia(atual, slot, registros);
        if (!treino) return false;
        return action === "mark-workout" ? marcarTreino(atual, treino, mark) : marcarExercicio(atual, treino, id, mark);
      }, "Checklist atualizado.");
      if (marcou) {
        renderizar();
        main.querySelector(recuperarSeletor(alvo))?.focus({ preventScroll: true });
      }
      break;
    }
    case "move-day": if (item && !item.sessao) modalDeTreino(item); break;
    case "organize": if (item && !item.sessao) organizar(item); break;
    case "move-exercise":
      if (item && !item.sessao && item.exercicios.includes(id) && item.exercicios.length > 1) modalDeExercicio(item, id);
      break;
    case "reorder": {
      if (!item) break;
      const mudou = await modificarAgenda((atual, registros) => {
        const treino = ocorrencia(atual, slot, registros);
        return treino && reordenar(atual, treino, id, Number(direction));
      }, "Ordem atualizada.");
      if (mudou && modal.open) {
        const treino = ocorrencia(agenda, slot, sessoes);
        const lista = modal.querySelector(".organizer-list");
        if (!lista) break;
        lista.outerHTML = listaOrganizador(treino);
        const botoes = [...modal.querySelectorAll(`[data-action="reorder"][data-id="${id}"]`)];
        (botoes.find((b) => b.dataset.direction === direction && !b.disabled)
          ?? botoes.find((b) => !b.disabled))?.focus({ preventScroll: true });
        renderizacaoPendente = true;
      } else if (mudou) renderizar();
      break;
    }
    default: return false;
  }
  return true;
}

async function salvarRemanejamento(form, dados) {
  const { form: tipo, slot, id } = form.dataset;
  const destino = dados.get("destino");
  const ok = await modificarAgenda((atual, registros) => {
    const de = ocorrencia(atual, slot, registros);
    if (!de) return false;
    if (tipo === "move-day") return moverTreino(atual, de, destino);
    const para = typeof destino === "string" && chaveValida(destino) && ocorrencia(atual, destino, registros);
    return para && transferirExercicio(atual, de, para, id);
  }, tipo === "move-day" ? "Treino remanejado." : "Exercício remanejado.");
  if (!ok) return;
  if (tipo === "move-day") {
    if (modal.open) modal.close();
    abrirCalendario(destino);
  } else if (modal.open) {
    organizar(ocorrencia(agenda, slot, sessoes));
    renderizacaoPendente = true;
  } else renderizar();
}

async function acionar(event) {
  const alvo = event.target.closest("[data-action]");
  if (!alvo) return;
  const { action, id, slot } = alvo.dataset;
  const num = Number(alvo.dataset.number);
  const atual = rota().sessao;
  const treino = slot && ocorrencia(agenda, slot, sessoes);
  event.preventDefault();

  switch (action) {
    case "home": selecionado = undefined; ir("#treino"); break;
    case "history": ir("#historico"); break;
    case "day":
      if (!treino) return;
      selecionado = treino.chave;
      renderizar();
      main.querySelector(recuperarSeletor(alvo))?.focus({preventScroll: true});
      anunciar(treino.treino.nome);
      break;
    case "start": {
      if (!treino) return;
      const idSessao = await modificar((itens) => {
        const item = ocorrencia(lerAgenda(localStorage), slot, itens);
        if (!item) return false;
        if (item.sessao) return item.sessao.id;
        const nova = {
          ...criarSessao(item.treino.id, new Date()),
          ocorrenciaId: item.chave,
          diaPlanejado: item.data,
          exercicios: [...item.exercicios],
        };
        itens.push(nova);
        return nova.id;
      });
      if (idSessao) ir("#sessao/" + idSessao);
      break;
    }
    case "session": ir("#sessao/" + id); break;
    case "guide": guia(id); break;
    case "close": modal.close(); break;
    case "edit": if (atual && !atual.fim) editor(atual, id, num); break;
    case "remove":
      await alterarSessao(atual, (item) => {
        item.registros[id] = (item.registros[id] ?? []).filter((serie) => serie.numero !== num);
      }, "Registro removido.");
      break;
    case "discard":
      if (await alterarSessao(atual, (item, itens, indice) => {
        if (totalRegistrado(item) !== 0) return false;
        itens.splice(indice, 1);
      }, "Sessão descartada.")) ir("#treino");
      break;
    case "finish":
    case "finish-confirm":
      if (!atual || totalRegistrado(atual) === 0) return;
      if (action === "finish" && totalRegistrado(atual) < contagem(dadosDaSessao(atual))) {
        confirmarFim(atual);
        return;
      }
      await alterarSessao(atual, (item) => {
        if (totalRegistrado(item) === 0) return false;
        item.fim = new Date().toISOString();
      }, "Sessão finalizada.");
      break;
    default: await agirNoCalendario(action, alvo, treino);
  }
}

document.addEventListener("click", acionar);
modal.addEventListener("submit", async (event) => {
  event.preventDefault();
  const dados = new FormData(event.target);
  if (event.target.dataset.form) {
    await salvarRemanejamento(event.target, dados);
    return;
  }
  const chave = event.target.dataset.id;
  const numero = Number(event.target.dataset.number);
  const serie = lerSerie(dados.get("quantidade"), dados.get("carga") ?? "");
  if (serie.erro) {
    modal.querySelector("[data-erro]").textContent = serie.erro;
    return;
  }
  const sessao = rota().sessao;
  if (await alterarSessao(sessao, (item) => {
    const outras = (item.registros[chave] ?? []).filter((existente) => existente.numero !== numero);
    item.registros[chave] = [...outras, {numero, ...serie}].sort((a, b) => a.numero - b.numero);
  }, "Série salva.")) {
    main.querySelector(`[data-action="edit"][data-id="${chave}"][data-number="${numero}"]`)?.focus({preventScroll: true});
  }
});

modal.addEventListener("close", () => {
  if (renderizacaoPendente) {
    renderizacaoPendente = false;
    renderizar();
  }
  if (focoAposFechar?.isConnected) focoAposFechar.focus({preventScroll: true});
  focoAposFechar = null;
});
window.addEventListener("hashchange", () => {
  if (modal.open) modal.close();
  renderizar(true);
});
window.addEventListener("storage", (event) => {
  if (event.key === CHAVE || event.key === CHAVE_AGENDA || event.key === null) {
    carregar();
    renderizar();
  }
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) renderizar();
});

carregar();
renderizar();
if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("./sw.js", {type: "module"}).catch(() => {});
}
