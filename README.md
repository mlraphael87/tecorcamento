# TEC Orcamento

Aplicacao web para gerar orcamentos de manutencao/reposicao de aparelhos auditivos, com numeracao de OS, historico e impressao em formato A4.

## Rodar localmente

```bash
npm install
npm start
```

Acesse `http://localhost:3333`.

Login padrao local:

- Usuario: `admin`
- Senha: `orcamento`

## Variaveis de ambiente

Para producao, defina:

- `APP_USER`: usuario de acesso
- `APP_PASSWORD`: senha de acesso
- `POSTGRES_URL` ou `DATABASE_URL`: URL de conexao PostgreSQL para historico persistente online

Sem `POSTGRES_URL`, a aplicacao usa SQLite local em `data/orcamentos.sqlite`.
