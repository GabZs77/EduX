import assert from "node:assert/strict";
import { test } from "node:test";
import { currentSchoolBimestre, summarizeAttendanceYear } from "./attendance.ts";
import type { FrequenciaBimestre } from "./types.ts";

function period(bimestre: number, aulasDadas: number, faltas: number): FrequenciaBimestre {
  return {
    descricaoBimestre: `${bimestre}º Bimestre`,
    bimestre,
    faltas,
    aulasDadas,
    frequencia: aulasDadas > 0 ? Math.round(((aulasDadas - faltas) / aulasDadas) * 1000) / 10 : null,
    disciplinas: [],
  };
}

test("usa as datas oficiais de 2026 para reconhecer o fim do 3º e o início do 4º bimestre", () => {
  assert.equal(currentSchoolBimestre(new Date("2026-10-04T12:00:00-03:00")), 3);
  assert.equal(currentSchoolBimestre(new Date("2026-10-06T12:00:00-03:00")), 4);
});

test("identifica o 3º bimestre durante setembro de 2026", () => {
  assert.equal(currentSchoolBimestre(new Date("2026-09-30T12:00:00-03:00")), 3);
});

test("calcula o acumulado anual ponderado somente até o bimestre atual", () => {
  const summary = summarizeAttendanceYear(
    [period(1, 100, 4), period(2, 100, 10), period(3, 200, 20), period(4, 50, 0)],
    3,
  );

  assert.deepEqual(summary, {
    aulasDadas: 400,
    faltas: 34,
    presencas: 366,
    frequencia: 91.5,
  });
});

test("não inventa percentual anual quando ainda não há aulas lançadas", () => {
  assert.deepEqual(summarizeAttendanceYear([period(1, 0, 0), period(2, 0, 0)], 2), {
    aulasDadas: 0,
    faltas: 0,
    presencas: 0,
    frequencia: null,
  });
});
