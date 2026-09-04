import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

function showFatalError(err) {
  const root = document.getElementById("root");
  if (!root) return;
  let details = "";
  try {
    details = (err && (err.stack || err.message)) || String(err);
    if (err && err.name) details = `${err.name}: ` + details;
  } catch (e) {
    details = "(could not read error details)";
  }
  root.innerHTML =
    '<div style="font-family: monospace; white-space: pre-wrap; padding: 24px; color: #a63d40; background: #fff; max-width: 700px; margin: 40px auto; border: 1px solid #dcd8cc; border-radius: 4px;">' +
    "<strong>Something failed while starting the app:</strong>\n\n" +
    details +
    "</div>";
}

window.addEventListener("error", (e) => showFatalError(e.error || e.message));
window.addEventListener("unhandledrejection", (e) => showFatalError(e.reason));

import("./App.jsx")
  .then(({ default: App }) => {
    ReactDOM.createRoot(document.getElementById("root")).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  })
  .catch((err) => showFatalError(err));
