import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

function showFatalError(err) {
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML =
      '<div style="font-family: monospace; white-space: pre-wrap; padding: 24px; color: #a63d40; background: #fff; max-width: 700px; margin: 40px auto; border: 1px solid #dcd8cc; border-radius: 4px;">' +
      "<strong>Something failed while starting the app:</strong>\n\n" +
      ((err && (err.stack || err.message)) || String(err)) +
      "</div>";
  }
}

window.addEventListener("error", (e) => showFatalError(e.error || e.message));
window.addEventListener("unhandledrejection", (e) => showFatalError(e.reason));

try {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (err) {
  showFatalError(err);
}
