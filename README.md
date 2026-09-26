# EduX

EduX é uma plataforma estudantil em português que reúne agenda, presença, boletim, tarefas e materiais acadêmicos em uma única experiência.

## Stack

- React 19 + TypeScript
- TanStack Start e TanStack Router
- Vite 8
- Tailwind CSS 4
- Componentes Radix UI e Lucide

## Plataformas

A navegação principal agora inclui a aba **Plataformas**. Ao clicar no cartão **LeiaSP**, o EduX abre uma página dedicada em tela cheia, que exibe as informações do aluno logado e a biblioteca de livros. A interface original do LeiaSP já possui o fluxo de seleção: ao clicar em um livro, ele inicia a leitura configurada.

O LeiaSP é uma aplicação FastAPI independente, por isso seu backend roda como um serviço separado do frontend EduX. Para executar localmente:

```bash
cd integrations/leiasp
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python app.py
```

No frontend, defina `VITE_LEIASP_URL` com a URL do serviço LeiaSP para que a aba Plataformas o incorpore em um iframe:

```bash
VITE_LEIASP_URL=http://localhost:8080 pnpm dev
```

Sem essa variável, a aba exibe as instruções de inicialização e mantém o botão para abrir a URL padrão `http://localhost:8080` em nova aba.

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
- `src/routes/plataformas.tsx`: seleção de plataformas.
- `src/routes/leiasp.tsx`: tela cheia e incorporação da experiência LeiaSP.
- `src/components/SdfApp.tsx`: montagem do bundle principal e link da navegação legada.
- `public/sdf-app.js` e `public/sdf-app.css`: aplicação e estilos principais distribuídos como assets estáticos.
- `integrations/leiasp/`: aplicação LeiaSP extraída do ZIP fornecido.
- `public/manus-storage/`: texturas e marca visual usadas pelo painel.
