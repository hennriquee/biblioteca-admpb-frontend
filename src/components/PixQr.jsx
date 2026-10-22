import { useMemo } from "react";
import qrcode from "qrcode-generator";

/**
 * QR code do PIX, desenhado aqui mesmo a partir do texto "copia e cola" (sem
 * imagem pronta e sem servico de fora): o que a camera le e sempre o mesmo
 * codigo que o botao "Copiar" copia.
 *
 * Fica sempre preto no branco, com a margem branca que os leitores pedem,
 * qualquer que seja o tema do app.
 */
export default function PixQr({ value, label }) {
  const { size, path } = useMemo(() => {
    // Nivel M de correcao: o padrao dos QR codes de PIX dos bancos.
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    let d = "";
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (qr.isDark(row, col)) d += "M" + col + " " + row + "h1v1h-1z";
      }
    }
    return { size: count, path: d };
  }, [value]);

  // 4 modulos de margem (a "zona quieta" que o padrao do QR code exige).
  const margin = 4;
  return (
    <svg
      className="pixqr"
      viewBox={-margin + " " + -margin + " " + (size + margin * 2) + " " + (size + margin * 2)}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect
        x={-margin}
        y={-margin}
        width={size + margin * 2}
        height={size + margin * 2}
        fill="#fff"
      />
      <path d={path} fill="#000" />
    </svg>
  );
}
