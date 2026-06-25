import { startTransition } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";

const router = getRouter();

startTransition(() => {
  const root = document.getElementById("root") ?? document.body;
  createRoot(root).render(<RouterProvider router={router} />);
});
