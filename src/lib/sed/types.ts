export type StudentSession = {
  nome: string;
  apelido: string;
  email?: string;
  cdUsuario?: number | string;
  cdUsuarioCurto: string;
  token: string;
  token2: string;
  usuario: string;
  demo?: boolean;
};

export type Room = {
  id: string | number | null;
  name: string;
  descricao?: string;
  escola?: string;
  curso?: string;
};

export type Task = {
  id: string | number | null;
  title: string;
  subject: string;
  room: string;
  status: string;
  due: string | null;
  raw?: unknown;
};

export type AgendaEvent = {
  id: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  nomeDisciplina: string;
  descricaoTurma?: string;
  sala?: string;
  tipo?: string;
};

export type BoletimRow = {
  id: string;
  disciplinaId?: number | string | null;
  bimestreNumero?: number | null;
  nomeDisciplina: string;
  disciplina: string;
  descricaoTurma?: string;
  faltas?: number | null;
  frequencia?: number | null;
  nota?: number | null;
  mediaFinal?: number | null;
  bimestre: string;
};

export type Avaliacao = {
  id: string;
  prova: string;
  data: string | null;
  nota: number | null;
  peso: number | null;
  bimestre: number | null;
  disciplinaId?: number | string | null;
  disciplina: string;
};

export type FrequenciaBimestre = {
  descricaoBimestre: string;
  bimestre: number;
  faltas: number;
  aulasDadas: number;
  frequencia: number | null;
  disciplinas: {
    nomeDisciplina: string;
    faltas: number;
    presencas: number;
    frequencia: number | null;
  }[];
};

export type Dashboard = {
  aluno?: Record<string, unknown>;
  turmas: Room[];
  tarefas: Task[];
  pendencias: number;
  faltas: number | null;
  mensagensNaoLidas?: number;
  mensagens?: number;
  agenda: AgendaEvent[];
  tarefasApiOk?: boolean;
  tarefasApiStatus?: number;
  tarefasApiError?: string;
  meta?: Record<string, unknown>;
};

export type CaptchaChallenge = {
  challengeId: string;
  image: string;
  sessionKey: string;
  captchaCookie: string;
};

export type TaskQuestion = {
  id: string;
  type: string;
  rawType: string;
  statement: string;
  options: { id: string; text: string }[];
  maxLength: number;
  raw: Record<string, unknown>;
};
