// Pagina de teste temporaria: o convite para contribuir, sozinho.
import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { ToastProvider } from "./components/Toast.jsx";
import ContributeModal from "./components/ContributeModal.jsx";
import SupportModal from "./components/SupportModal.jsx";
import "./styles/tokens.css";
import "./styles/app.css";

const params = new URLSearchParams(location.search);

function Harness() {
  const [open, setOpen] = useState(true);
  const [support, setSupport] = useState(false);
  return (
    <ToastProvider>
      <button type="button" id="reopen" onClick={() => setOpen(true)}>abrir</button>
      <ContributeModal
        open={open}
        title={params.get("title") || "O Peregrino"}
        duplicate={params.get("dup") === "1"}
        onClose={() => setOpen(false)}
        onContribute={() => {
          setOpen(false);
          setSupport(true);
        }}
      />
      <SupportModal open={support} onClose={() => setSupport(false)} />
    </ToastProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Harness />
  </React.StrictMode>,
);
