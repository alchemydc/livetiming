import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./app.css";

function App() {
  return <main className="p-4 font-sans">livetiming spike</main>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
