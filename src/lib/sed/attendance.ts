import type { FrequenciaBimestre } from "./types";

export type AttendanceYearSummary = {
  aulasDadas: number;
  faltas: number;
  presencas: number;
  frequencia: number | null;
};

export function latestAttendanceBimestre(rows: FrequenciaBimestre[]): FrequenciaBimestre | null {
  return rows.reduce<FrequenciaBimestre | null>((latest, row) => {
    const hasLaunches =
      row.aulasDadas > 0 ||
      row.faltas > 0 ||
      row.disciplinas.some((disciplina) => disciplina.presencas > 0 || disciplina.faltas > 0);
    if (!hasLaunches) return latest;
    if (!latest || row.bimestre > latest.bimestre) return row;
    return latest;
  }, null);
}

export function summarizeAttendanceYear(
  rows: FrequenciaBimestre[],
  throughBimestre: number,
): AttendanceYearSummary {
  const periods = rows.filter((row) => row.bimestre <= throughBimestre);
  const aulasDadas = periods.reduce((total, row) => total + Math.max(0, row.aulasDadas), 0);
  const faltas = periods.reduce((total, row) => total + Math.max(0, row.faltas), 0);
  const presencas = Math.max(0, aulasDadas - faltas);
  const frequencia = aulasDadas > 0 ? Math.round((presencas / aulasDadas) * 1000) / 10 : null;

  return { aulasDadas, faltas, presencas, frequencia };
}
