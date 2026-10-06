import { createFileRoute } from "@tanstack/react-router";
import { IaPage } from "@/components/academic-pages";
import { Guarded } from "@/components/guarded";

export const Route = createFileRoute("/inteligencia-artificial")({
  component: () => (
    <Guarded>
      <IaPage />
    </Guarded>
  ),
});
