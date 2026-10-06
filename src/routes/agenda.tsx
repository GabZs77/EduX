import { createFileRoute } from "@tanstack/react-router";
import { AgendaPage } from "@/components/academic-pages";
import { Guarded } from "@/components/guarded";

export const Route = createFileRoute("/agenda")({
  component: () => (
    <Guarded>
      <AgendaPage />
    </Guarded>
  ),
});
