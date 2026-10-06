import assert from "node:assert/strict";
import { test } from "node:test";
import { latestAttendanceBimestre, summarizeAttendanceYear } from "./attendance.ts";
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

test("identifica o bimestre mais recente que tem lançamentos", () => {
  const current = latestAttendanceBimestre([
    period(3, 200, 20),
    period(1, 100, 4),
    period(4, 0, 0),
    period(2, 100, 10),
  ]);

  assert.equal(current?.bimestre, 3);
});

test("calcula o acumulado anual ponderado até o bimestre atual", () => {
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
  const rows = [period(1, 0, 0), period(2, 0, 0)];

  assert.equal(latestAttendanceBimestre(rows), null);
  assert.deepEqual(summarizeAttendanceYear(rows, 2), {
    aulasDadas: 0,
    faltas: 0,
    presencas: 0,
    frequencia: null,
  });
});
