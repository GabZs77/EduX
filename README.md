# EduX

EduX é uma plataforma estudantil em português que reúne agenda, presença, boletim, tarefas e materiais acadêmicos em uma única experiência.

## Stack

- React 19 + TypeScript
- TanStack Start e TanStack Router
- Vite 8
- Tailwind CSS 4
- Componentes Radix UI e Lucide

## Desenvolvimento local

Requisitos: Node.js 22 ou superior e pnpm.

```bash
pnpm install
pnpm dev
```

O servidor de desenvolvimento fica disponível em `http://localhost:3000`.

## Validação e build

```bash
pnpm lint
pnpm build
```

O projeto utiliza o build padrão do Vite/TanStack Start e está preparado para deploy contínuo pelo Vercel a partir da branch `main`.

## Estrutura principal

- `src/routes/`: rotas TanStack Router e shell da aplicação.
- `src/components/SdfApp.tsx`: montagem do bundle principal da experiência EduX.
- `public/sdf-app.js` e `public/sdf-app.css`: aplicação e estilos principais distribuídos como assets estáticos.
- `public/manus-storage/`: texturas e marca visual usadas pelo painel.
