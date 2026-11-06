# Conteúdo dos temas

## Adicionar um tema

1. Criar `src/content/temas/<slug>.md`. O nome do arquivo é o endereço da página (`/temas/<slug>/`): minúsculas,
   números e hífens, sem acentos (por exemplo `saude-mental.md`). Os slugs exigidos no estágio `final` estão em
   `release.config.json`.
2. Preencher os metadados no início do arquivo e escrever o texto em Markdown logo abaixo:

   ```markdown
   ---
   title: "Título do tema"
   area: "Nutrição"
   icone: "🥗"
   resumo: "Uma ou duas frases que resumem o tema (de 20 a 280 caracteres)."
   ordem: 1
   status: "rascunho"
   ---
   ## Primeira seção

   Texto do tema.
   ```

3. Começar o texto em `##`: o título da página vem de `title`, e um `#` geraria um segundo título principal. Não pular
   níveis (`##`, depois `###`). Imagens exigem texto alternativo e licença ou autorização.
4. Pré-visualizar com `npm run dev`, que roda em modo teste e mostra os rascunhos com banner.

## Metadados

| Campo | Obrigatório | Regra |
|---|---|---|
| `title` | sim | de 3 a 120 caracteres |
| `area` | sim | Enfermagem, Nutrição, Fisioterapia, Odontologia, Psicologia, Biomedicina ou Computação |
| `icone` | sim | texto decorativo curto, de 1 a 16 caracteres; emoji é recomendado, mas o schema não verifica que seja um emoji |
| `resumo` | sim | de 20 a 280 caracteres |
| `ordem` | sim | inteiro maior ou igual a 1; define a ordem na listagem; valores repetidos são permitidos |
| `status` | sim | `rascunho` ou `aprovado`; a ausência é erro e nunca vale como aprovação |
| `revisadoPor` | se `aprovado` | nome de quem revisou |
| `revisadoEm` | se `aprovado` | data real e não futura, **entre aspas**, no formato `"AAAA-MM-DD"` |
| `referencias` | se `aprovado` (ao menos 1) | lista de `titulo`, `instituicao`, `url` (https) e `acessadoEm` (data entre aspas) |

O `icone` é decorativo (os leitores de tela o ignoram), e os espaços nas pontas são removidos. O limite de 16 conta
caracteres Unicode (pontos de código), então um emoji composto pode ocupar mais de um. Temas com a mesma `ordem` são
aceitos e aparecem em ordem alfabética de `title` (pt-BR); se o título também coincidir, vale a ordem alfabética do
nome do arquivo.

Campos não previstos são rejeitados, para que um erro de digitação não passe em silêncio. As datas precisam de aspas
porque o YAML converteria uma data sem aspas e aceitaria dias inexistentes (`2026-02-30` viraria 02/03).
Metadados inválidos interrompem o build com a mensagem do campo e o nome do arquivo.

## Aprovação editorial

Nenhum conteúdo de saúde é publicado sem aprovação escrita do responsável da área.

1. Incluir o texto como `status: "rascunho"`, com as referências enviadas pelo responsável.
2. O responsável revisa o texto e as referências e aprova por escrito, informando a versão.
3. Registrar a aprovação em `docs/revisoes.md`.
4. Trocar para `status: "aprovado"` e preencher `revisadoPor`, `revisadoEm` e `referencias`.
5. Enviar a alteração; a CI valida o build e só então publica.

O build confere que os metadados existem e são válidos; ele não verifica que a aprovação foi dada. Essa
responsabilidade é do passo 2.

## Rascunhos e produção

- Build de produção (`npm run build`, o único publicado): só temas `aprovado`. Rascunhos não geram página nem
  aparecem na listagem. O portão de release reprova qualquer vestígio de rascunho em `dist/`.
- Build de teste (`MODO=teste`) e `npm run dev`: incluem os rascunhos, com banner "Conteúdo em revisão" e a marca
  "Em revisão" na listagem.
- `demo-estrutura.md` e `demo-minimo.md` são textos fictícios, sempre `rascunho`, usados pelos testes de navegador
  (`tests/e2e/helpers.ts`). Não os aprove nem os use como material educativo.

## Código

- `src/lib/tema.ts`: schema dos metadados e regras de publicação. Não usa as APIs de conteúdo do Astro
  (`astro:content`), mas importa o Zod exposto por `astro/zod`; por isso pode ser testado diretamente no Vitest.
- `src/content.config.ts`: declara a coleção `temas`.
- `src/lib/conteudo.ts`: único ponto que consulta a coleção; páginas e listagens usam `listarTemas()`.
