import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/info/help-centre")({ beforeLoad: () => { throw redirect({ to: "/help" }); } });
