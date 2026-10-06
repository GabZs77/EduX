import { createFileRoute } from "@tanstack/react-router";
import { NotasPage } from "@/components/academic-pages";
import { Guarded } from "@/components/guarded";

export const Route = createFileRoute("/notas")({
  component: () => (
    <Guarded>
      <NotasPage />
    </Guarded>
  ),
});
