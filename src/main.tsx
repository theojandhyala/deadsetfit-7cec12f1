import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { restoreSupabaseSession } from "./integrations/supabase/client";
import "./styles.css";

const root = document.getElementById("root")!;

void restoreSupabaseSession().finally(() => {
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );
});
