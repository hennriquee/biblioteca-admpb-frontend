import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import SiteGate from "./components/SiteGate.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ToastProvider } from "./components/Toast.jsx";
import { wakeBackend } from "./api/client.js";
import { registerSW } from "virtual:pwa-register";
import "./styles/tokens.css";
import "./styles/app.css";

// Dispara assim que o script carrega, antes mesmo do React desenhar a tela,
// para o backend no Render comecar a acordar o mais cedo possivel.
wakeBackend();

// Registra o service worker do PWA; atualiza sozinho quando ha nova versao.
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* "Nao sou um robo" na frente do site inteiro. Fica ACIMA do
          AuthProvider: o servidor recusa qualquer pedido sem o passe, entao
          o login so e restaurado depois da caixa. */}
      <SiteGate>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </SiteGate>
    </BrowserRouter>
  </React.StrictMode>,
);
