// backend/src/teste_env.ts

import 'dotenv/config'; // Carrega as variáveis do arquivo .env

console.log('--- Teste de Conexão ---');
const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl) {
  console.log('✅ Sucesso! A variável DATABASE_URL foi encontrada:');
  console.log(databaseUrl);
} else {
  console.error('❌ Falha! A variável DATABASE_URL não foi encontrada no .env.');
  console.log('Verifique se o arquivo .env está na pasta "backend" e tem o conteúdo correto.');
}
console.log('------------------------');