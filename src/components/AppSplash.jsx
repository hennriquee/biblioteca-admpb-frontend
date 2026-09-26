import { useEffect, useState } from "react";

/**
 * Tela de abertura do app: mostra a logo da biblioteca em tela cheia
 * por um instante quando o app é iniciado (funciona tanto no navegador
 * quanto quando instalado como PWA no celular), depois desaparece com
 * um fade suave revelando o conteudo.
 */
export default function AppSplash({ duration = 1100 }) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), duration);
    const removeTimer = setTimeout(() => setVisible(false), duration + 400);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [duration]);

  if (!visible) return null;

  return (
    <div className={`app-splash${fading ? " app-splash--fade" : ""}`}>
      <img
        src="/img/logo-biblioteca.png"
        alt="Biblioteca ADMP Brasil"
        className="app-splash__logo"
      />
    </div>
  );
}
