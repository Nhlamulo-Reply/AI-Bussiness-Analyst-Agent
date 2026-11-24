import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyTheme, getInitialTheme } from "./features/theme/theme";
import "./styles/tokens.css";
import "./styles/global.css";

applyTheme(getInitialTheme());

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("The frontend root element is missing.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
