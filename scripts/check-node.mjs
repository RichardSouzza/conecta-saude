// Falha se a versão do Node em execução não for exatamente a do .nvmrc.
import { readFileSync } from 'node:fs';

const esperado = readFileSync(new URL('../.nvmrc', import.meta.url), 'utf8')
  .trim()
  .replace(/^v/, '');
const atual = process.versions.node;

if (atual !== esperado) {
  console.error(`✖ Node ${atual} em execução, mas o .nvmrc exige ${esperado}.`);
  process.exit(1);
}
console.log(`✔ Node ${atual} confere com o .nvmrc`);
