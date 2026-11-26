import { exercicios } from "./catalogo.js";

const base = new URL("./", self.registration.scope);
const prefixo = `pulso-web@${base.pathname}:`;
const chave = prefixo + "v2";
const arquivos = [
  "index.html", "app.js", "styles.css", "catalogo.js", "diario.js", "agenda.js", "calendario.js", "manifest.webmanifest",
  "assets/capivara.webp", "assets/icon-180.png", "assets/icon-192.png", "assets/icon-512.png",
  ...Object.values(exercicios).flatMap((exercicio) => exercicio.fotos.map((foto) => "assets/photos/" + foto)),
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(chave)
    .then((cache) => cache.addAll(arquivos.map((arquivo) => new URL(arquivo, base))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith(prefixo) && key !== chave).map((key) => caches.delete(key)),
  )).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || !url.href.startsWith(base.href)) return;

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match(new URL("index.html", base))));
  } else if (arquivos.some((arquivo) => url.href === new URL(arquivo, base).href)) {
    if (url.pathname.startsWith(base.pathname + "assets/photos/")) {
      event.respondWith(caches.match(event.request).then((cached) => cached ?? fetch(event.request)));
    } else {
      event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    }
  }
});
