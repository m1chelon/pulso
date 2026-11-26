# Pulso

Diário web de treino de hipertrofia para iPhone e outros navegadores. Abre no treino do dia ou no próximo treino em dias de descanso.

| Dia | Treino |
|---|---|
| Terça | Superiores A |
| Quarta | Inferiores A |
| Sábado | Superiores B |
| Domingo | Inferiores B |

O calendário mostra os treinos do mês e permite marcar **Fiz** ou **Não fiz** por exercício. Nas sessões que ainda não começaram, você pode mudar a data do treino, reorganizar a lista e mover um exercício para outro treino disponível. As mudanças valem para a sessão escolhida.

O catálogo reúne 15 exercícios com fotos e instruções em português. O diário registra séries, repetições, carga e tempo de prancha. Os registros ficam no navegador de cada aparelho. Após a primeira carga completa em HTTPS, o app usa um cache local para abrir offline em navegadores compatíveis.

## GitHub Pages

Coloque todos os arquivos deste pacote na raiz do repositório, inclusive `.nojekyll` e a pasta `assets`. Em **Settings → Pages**, selecione **Deploy from a branch**, **main** e **/ (root)**. O GitHub mostra o endereço público nessa página após publicar.

[Manual do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Abrir no iPhone

Abra o endereço publicado no Safari. Use **Compartilhar → Adicionar à Tela de Início** e ative **Abrir como App da Web** quando o Safari exibir essa opção.

## Desenvolvimento

Site estático em HTML, CSS e JavaScript. Para testar localmente, rode `python3 -m http.server 8080` na raiz e abra `http://localhost:8080`. Na publicação é preciso HTTPS para ativar o cache offline.

Fotos do [Free Exercise DB](https://github.com/yuhonas/free-exercise-db). A licença acompanha o projeto em `assets/LICENCA-FOTOS.txt`.
