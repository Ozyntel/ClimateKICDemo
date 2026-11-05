import { createRoot } from "react-dom/client";
import App from "./App";
import { applyStartCase } from "./lib/lead/startCase";
import "./index.css";

// A dedicated deployment can open straight into one demo case (VITE_START_CASE); otherwise this does nothing.
void applyStartCase(import.meta.env.VITE_START_CASE).finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
