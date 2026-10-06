import type {
  AgendaEvent,
  Avaliacao,
  BoletimRow,
  Dashboard,
  FrequenciaBimestre,
  StudentSession,
} from "./types";

function fmt(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nextWorkdays(count = 5) {
  const days: Date[] = [];
  const cursor = new Date();
  for (let i = 0; days.length < count && i < 14; i += 1) {
    const day = new Date(cursor);
    day.setDate(cursor.getDate() + i);
    const dow = day.getDay();
    if (dow !== 0 && dow !== 6) days.push(day);
  }
  return days;
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const SUBJECTS = [
  { nome: "Língua Portuguesa", inicio: "07:00", fim: "07:50" },
  { nome: "Matemática", inicio: "07:50", fim: "08:40" },
  { nome: "Intervalo", inicio: "08:40", fim: "09:00" },
  { nome: "História", inicio: "09:00", fim: "09:50" },
  { nome: "Biologia", inicio: "09:50", fim: "10:40" },
  { nome: "Inglês", inicio: "10:50", fim: "11:40" },
  { nome: "Educação Física", inicio: "11:40", fim: "12:30" },
];

export const DEMO_SESSION: StudentSession = {
  nome: "Ana Beatriz Souza",
  apelido: "ana.souza",
  email: "ana.souza@escola.sp.gov.br",
  cdUsuario: 12345670,
  cdUsuarioCurto: "1234567",
  token: "demo",
  token2: "demo",
  usuario: "1234567XSP",
  demo: true,
};

export function demoAgenda(): AgendaEvent[] {
  const days = nextWorkdays(5);
  const events: AgendaEvent[] = [];
  days.forEach((day, di) => {
    const date = ymd(day);
    SUBJECTS.forEach((sub, i) => {
      events.push({
        id: `${date}-${i}`,
        data: date,
        horaInicio: sub.inicio,
        horaFim: sub.fim,
        nomeDisciplina: sub.nome,
        descricaoTurma: "Ensino Médio - 2ª Série A",
        tipo: /intervalo/i.test(sub.nome) ? "intervalo" : "aula",
      });
    });
    if (di === 2) {
      events.push({
        id: `${date}-evento`,
        data: date,
        horaInicio: "13:30",
        horaFim: "15:00",
        nomeDisciplina: "Reunião de pais e mestres",
        tipo: "evento",
      });
    }
  });
  return events;
}

export function demoDashboard(): Dashboard {
  const agenda = demoAgenda();
  return {
    aluno: { nome: DEMO_SESSION.nome, escola: "EE Prof. João da Silva" },
    turmas: [
      {
        id: 1,
        name: "Ensino Médio - 2ª Série A",
        escola: "EE Prof. João da Silva",
        curso: "Ensino Médio",
      },
    ],
    tarefas: [
      {
        id: "t1",
        title: "Leitura orientada — Machado de Assis",
        subject: "Língua Portuguesa",
        room: "Ensino Médio - 2ª Série A",
        status: "pending",
        due: fmt(3),
      },
      {
        id: "t2",
        title: "Lista de funções do 2º grau",
        subject: "Matemática",
        room: "Ensino Médio - 2ª Série A",
        status: "pending",
        due: fmt(5),
      },
      {
        id: "t3",
        title: "Mapa das civilizações pré-colombianas",
        subject: "História",
        room: "Ensino Médio - 2ª Série A",
        status: "draft",
        due: fmt(8),
      },
    ],
    pendencias: 3,
    faltas: 4,
    mensagensNaoLidas: 2,
    mensagens: 5,
    agenda,
  };
}

export function demoBoletim(): BoletimRow[] {
  const materias = [
    ["Língua Portuguesa", 7.5, 8.0, 7.8],
    ["Matemática", 6.5, 7.2, 7.0],
    ["História", 8.5, 8.0, 8.2],
    ["Geografia", 7.0, 7.5, 7.4],
    ["Biologia", 8.0, 8.5, 8.2],
    ["Física", 6.0, 6.8, 6.5],
    ["Química", 7.2, 7.0, 7.1],
    ["Inglês", 9.0, 8.5, 8.8],
    ["Educação Física", 10, 10, 10],
    ["Arte", 8.5, 9.0, 8.8],
  ] as const;
  const rows: BoletimRow[] = [];
  materias.forEach(([nome, n1, n2, n3], i) => {
    [n1, n2, n3].forEach((nota, b) => {
      rows.push({
        id: `${i}-${b + 1}`,
        disciplinaId: i + 1,
        bimestreNumero: b + 1,
        nomeDisciplina: nome,
        disciplina: nome,
        descricaoTurma: "2ª Série A",
        faltas: b === 2 ? (i % 3) : 0,
        frequencia: 96 - i,
        nota,
        bimestre: `${b + 1}º Bimestre`,
      });
    });
    const media = Number((((n1 + n2 + n3) / 3) as number).toFixed(1));
    rows.push({
      id: `${i}-final`,
      disciplinaId: i + 1,
      nomeDisciplina: nome,
      disciplina: nome,
      nota: media,
      mediaFinal: media,
      bimestre: "Média final",
    });
  });
  return rows;
}

export function demoAvaliacoes(): Avaliacao[] {
  return [
    { id: "a1", prova: "Prova bimestral", data: fmt(-12), nota: 7.5, peso: 2, bimestre: 3, disciplinaId: 1, disciplina: "Língua Portuguesa" },
    { id: "a2", prova: "Trabalho de redação", data: fmt(-20), nota: 8.0, peso: 1, bimestre: 3, disciplinaId: 1, disciplina: "Língua Portuguesa" },
    { id: "a3", prova: "Lista + prova", data: fmt(-10), nota: 7.2, peso: 2, bimestre: 3, disciplinaId: 2, disciplina: "Matemática" },
    { id: "a4", prova: "Seminário", data: fmt(-18), nota: 8.5, peso: 1, bimestre: 3, disciplinaId: 3, disciplina: "História" },
    { id: "a5", prova: "Experimento de laboratório", data: fmt(-8), nota: 8.5, peso: 1, bimestre: 3, disciplinaId: 5, disciplina: "Biologia" },
  ];
}

export function demoFrequencia(): { data: FrequenciaBimestre[]; faltas: number } {
  const disciplinas = [
    { nomeDisciplina: "Língua Portuguesa", faltas: 1, presencas: 38, frequencia: 97.4 },
    { nomeDisciplina: "Matemática", faltas: 2, presencas: 36, frequencia: 94.7 },
    { nomeDisciplina: "História", faltas: 0, presencas: 32, frequencia: 100 },
    { nomeDisciplina: "Biologia", faltas: 1, presencas: 30, frequencia: 96.8 },
    { nomeDisciplina: "Inglês", faltas: 0, presencas: 28, frequencia: 100 },
  ];
  const data: FrequenciaBimestre[] = [1, 2, 3].map((bimestre) => ({
    descricaoBimestre: `${bimestre}º Bimestre`,
    bimestre,
    faltas: bimestre === 3 ? 4 : bimestre,
    aulasDadas: 160,
    frequencia: bimestre === 3 ? 97.5 : 98.5 - bimestre,
    disciplinas,
  }));
  return { data, faltas: 4 };
}

export const DEMO_TASK_DETAILS = {
  title: "Leitura orientada — Machado de Assis",
  statement: "<p>Leia o fragmento e responda. Considere o contexto do Realismo brasileiro.</p>",
  questions: [
    {
      id: "q1",
      type: "single",
      statement: "Qual característica do Realismo aparece com mais força no trecho?",
      options: [
        { id: "a", text: "Idealização romântica do herói" },
        { id: "b", text: "Análise psicológica e crítica social" },
        { id: "c", text: "Exaltação da natureza tropical" },
        { id: "d", text: "Narrativa de cavalaria medieval" },
      ],
    },
    {
      id: "q2",
      type: "text",
      statement: "Em 4 a 6 linhas, explique como o narrador constrói a ironia no episódio.",
    },
  ],
};
