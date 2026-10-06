import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/ia")({
  component: () => <Navigate to="/inteligencia-artificial" />,
});
