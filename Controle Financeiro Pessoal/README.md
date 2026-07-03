# Controle Financeiro Pessoal — MVP

Sistema web para organizar receitas, despesas e orçamentos mensais.

## Requisitos atendidos

- **Node.js** no backend.
- **Frontend com Vue 3**.
- **Backend e frontend separados** em pastas diferentes.
- **Banco de dados obrigatório**: SQLite (`backend/data/finance.db`).
- **CRUD funcional**:
  - Transações: criar, listar, editar e excluir.
  - Categorias: criar, listar, editar e excluir quando não estiverem em uso.
  - Orçamentos: criar, listar, editar e excluir.
- **MVP com problema real**: acompanhamento de saldo, gastos por categoria e limites mensais.

## Estrutura

```text
controle-financeiro-pessoal-mvp/
├── backend/
│   ├── server.js
│   ├── db.py
│   └── data/
│       └── finance.db
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── package.json
```

## Como executar

```bash
npm start
```

O servidor Node.js sobe a aplicação completa na porta `3000`.

No Windows, abra o terminal dentro da pasta do projeto ou dê dois cliques em `iniciar-windows.bat`.

## Modelo do banco

### categories

Categorias de receita ou despesa.

### transactions

Lançamentos financeiros com descrição, valor, tipo, categoria, data, método e observações.

### budgets

Limites mensais por categoria de despesa.

## Rotas principais

- `GET /api/bootstrap`
- `GET /api/transactions`
- `POST /api/transactions`
- `PUT /api/transactions/:id`
- `DELETE /api/transactions/:id`
- `GET /api/categories`
- `POST /api/categories`
- `PUT /api/categories/:id`
- `DELETE /api/categories/:id`
- `GET /api/budgets`
- `POST /api/budgets`
- `PUT /api/budgets/:id`
- `DELETE /api/budgets/:id`

## Observação técnica

Para evitar dependências externas de instalação, o servidor Node.js usa módulos nativos e chama um pequeno utilitário Python para operar o SQLite com segurança via queries parametrizadas. O Vue 3 está salvo localmente em `frontend/vue.global.prod.js`.
