# EduX

Área do aluno com foco em **Notas**. A navegação principal mantém somente a aba Notas; a página inicial abre diretamente o boletim.

## Desenvolvimento

Requisitos: Node.js 22 ou superior.

```bash
npm ci
npm run dev
```

## Validação e build

```bash
npm run typecheck
npm run build
```

## Estrutura

- `src/routes/`: rotas do app.
- `src/components/academic-pages.tsx`: telas acadêmicas, incluindo Notas.
- `src/lib/sed/`: integração e tipos de dados acadêmicos.
- `public/`: identidade visual e assets estáticos.
