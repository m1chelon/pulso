import { exercicios, plano } from "./catalogo.js";
import {
  CHAVE, cargaFormatada, criarSessao, dataCurta, dataLonga, dias, lerDiario,
  lerSerie, proximoTreino, salvarDiario, sessaoAtual, totalRegistrado, treinoDoDia, ultimaCarga,
} from "./diario.js";

const main = document.querySelector("#main");
const modal = document.querySelector("#modal");
const status = document.querySelector("#status");
const porId = new Map(plano.map((treino) => [treino.id, treino]));
let sessoes = [];
let erroLeitura = false;
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
}

function anunciar(mensagem) {
  status.textContent = mensagem;
}

async function modificar(operacao) {
  const executar = () => {
    const atuais = lerDiario(localStorage);
    const resultado = operacao(atuais);
    salvarDiario(localStorage, atuais);
    sessoes = atuais;
    erroLeitura = erroGravacao = false;
    return resultado;
  };
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

function avisoDiario() {
  if (!erroLeitura && !erroGravacao) return "";
  return `<p class="warning" role="alert">${erroLeitura
    ? "O diário local está indisponível. Recarregue a página para tentar novamente."
    : "O navegador não conseguiu salvar. Tente novamente."}</p>`;
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

function acao(treino, atual) {
  const sessao = sessaoAtual(sessoes, treino.id, atual);
  const texto = sessao?.fim ? "Ver sessão" : sessao ? "Retomar treino" : "Iniciar treino";
  return `<button class="primary" type="button" data-action="start" data-id="${treino.id}">${texto}</button>`;
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
  const hoje = treinoDoDia(plano, agora);
  const pendente = [...sessoes].reverse().find((sessao) => !sessao.fim && porId.has(sessao.treinoId));
  const treino = porId.get(selecionado) ?? porId.get(pendente?.treinoId) ?? hoje ?? proximoTreino(plano, agora);
  const sessao = sessaoAtual(sessoes, treino.id, agora);
  const rotulo = sessao?.fim ? "Concluído hoje" : sessao ? "Em andamento"
    : treino.id === hoje?.id ? "Treino de hoje" : !selecionado && !hoje ? "Próximo treino" : dias[treino.dia];
  const fotoDestaque = foto(exercicios[treino.exercicios[0]]);
  const diasDaSemana = plano.map((dia) => `<li>
    <button class="week-day" type="button" data-action="day" data-id="${dia.id}" aria-pressed="${treino.id === dia.id}">
      <span><small>${dias[dia.dia]}${dia.id === hoje?.id ? " · Hoje" : ""}</small><strong>${dia.nome}</strong></span>
      <span class="chevron" aria-hidden="true">›</span>
    </button>
  </li>`).join("");

  return `${cabecalho("Seu treino", dataLonga(agora))}
    ${avisoDiario()}
    <section class="hero" aria-labelledby="treino-destaque">
      <img class="hero-image" src="${fotoDestaque}" alt="" width="850" height="567">
      <div class="hero-content">
        <p class="hero-state"><span aria-hidden="true"></span>${rotulo}</p>
        <h2 id="treino-destaque">${treino.nome}</h2>
        <p class="hero-description">${treino.descricao}</p>
        <p class="hero-count">${treino.exercicios.length} exercícios · ${contagem(treino)} séries</p>
        ${acao(treino, agora)}
      </div>
    </section>
    <div class="dashboard-grid">
      <section class="panel week" aria-labelledby="semana"><h2 id="semana">Plano semanal</h2><ul>${diasDaSemana}</ul></section>
      <section class="panel exercises" aria-labelledby="lista"><h2 id="lista">Exercícios</h2><ul>${listaPlano(treino)}</ul></section>
    </div>`;
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
  return `<button type="button" class="back" data-action="${sessao.fim ? "history" : "home"}">‹ ${sessao.fim ? "Histórico" : "Plano semanal"}</button>
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
  else if (atual.nome === "session") main.innerHTML = telaSessao(atual.sessao, porId.get(atual.sessao.treinoId));
  else main.innerHTML = telaTreino();
  const historico = atual.nome === "history" || Boolean(atual.sessao?.fim);
  for (const aba of document.querySelectorAll(".tabs button")) {
    if (aba.dataset.action === (historico ? "history" : "home")) aba.setAttribute("aria-current", "page");
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
  focoAposFechar = document.activeElement;
  modal.className = classe;
  modal.innerHTML = conteudo;
  modal.showModal();
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

async function acionar(event) {
  const alvo = event.target.closest("[data-action]");
  if (!alvo) return;
  const { action, id } = alvo.dataset;
  const num = Number(alvo.dataset.number);
  const atual = rota().sessao;
  const treino = porId.get(id);
  event.preventDefault();

  switch (action) {
    case "home": selecionado = undefined; ir("#treino"); break;
    case "history": ir("#historico"); break;
    case "day":
      if (!treino) return;
      selecionado = treino.id;
      renderizar();
      document.querySelector(`[data-action="day"][data-id="${treino.id}"]`).focus({preventScroll: true});
      anunciar(treino.nome);
      break;
    case "start": {
      if (!treino) return;
      const idSessao = await modificar((itens) => {
        const agora = new Date();
        const existente = sessaoAtual(itens, treino.id, agora);
        if (existente) return existente.id;
        const nova = criarSessao(treino.id, agora);
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
      if (action === "finish" && totalRegistrado(atual) < contagem(porId.get(atual.treinoId))) {
        confirmarFim(atual);
        return;
      }
      await alterarSessao(atual, (item) => {
        if (totalRegistrado(item) === 0) return false;
        item.fim = new Date().toISOString();
      }, "Sessão finalizada.");
      break;
  }
}

document.addEventListener("click", acionar);
modal.addEventListener("submit", async (event) => {
  event.preventDefault();
  const dados = new FormData(event.target);
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
  if (event.key === CHAVE || event.key === null) {
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
