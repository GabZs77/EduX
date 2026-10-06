import { createFileRoute } from "@tanstack/react-router";
import { PresencaPage } from "@/components/academic-pages";
import { Guarded } from "@/components/guarded";

export const Route = createFileRoute("/presenca")({
  component: () => (
    <Guarded>
      <PresencaPage />
    </Guarded>
  ),
});
