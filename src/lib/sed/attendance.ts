import type { FrequenciaBimestre } from "./types";

export type AttendanceYearSummary = {
  aulasDadas: number;
  faltas: number;
  presencas: number;
  frequencia: number | null;
};

function dateInSaoPaulo(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "00";
  return { year: Number(get("year")), iso: `${get("year")}-${get("month")}-${get("day")}`, month: Number(get("month")) };
}

export function currentSchoolBimestre(date = new Date()): number {
  const { year, iso, month } = dateInSaoPaulo(date);

  // Datas do calendário escolar oficial da SEDUC-SP para 2026.
  if (year === 2026) {
    if (iso < "2026-02-02") return 0;
    if (iso <= "2026-04-22") return 1;
    if (iso <= "2026-07-06") return 2;
    if (iso < "2026-07-24") return 2;
    if (iso <= "2026-10-02") return 3;
    if (iso < "2026-10-05") return 3;
    return 4;
  }

  // Fallback para anos seguintes até o calendário oficial correspondente ser cadastrado.
  if (month === 1) return 0;
  if (month <= 4) return 1;
  if (month <= 6) return 2;
  if (month <= 9) return 3;
  return 4;
}

export function summarizeAttendanceYear(
  rows: FrequenciaBimestre[],
  throughBimestre?: number,
): AttendanceYearSummary {
  const periods = throughBimestre == null ? rows : rows.filter((row) => row.bimestre <= throughBimestre);
  const aulasDadas = periods.reduce((total, row) => total + Math.max(0, row.aulasDadas), 0);
  const faltas = periods.reduce((total, row) => total + Math.max(0, row.faltas), 0);
  const presencas = Math.max(0, aulasDadas - faltas);
  const frequencia = aulasDadas > 0 ? Math.round((presencas / aulasDadas) * 1000) / 10 : null;

  return { aulasDadas, faltas, presencas, frequencia };
}
