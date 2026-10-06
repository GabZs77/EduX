import { createFileRoute } from "@tanstack/react-router";
import { TarefasPage } from "@/components/academic-pages";
import { Guarded } from "@/components/guarded";

export const Route = createFileRoute("/tarefas")({
  component: () => (
    <Guarded>
      <TarefasPage />
    </Guarded>
  ),
});
