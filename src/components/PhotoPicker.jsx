import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Avatar from "./Avatar.jsx";
import CoverEditor from "./CoverEditor.jsx";
import WebcamCapture from "./WebcamCapture.jsx";
import { IconCamera, IconImage, IconTrash } from "./Icons.jsx";

// Celular/tablet (toque): <input capture> abre direto o app da camera.
// Computador: abrimos a webcam dentro do proprio app.
function isTouchDevice() {
  try {
    return window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

/**
 * Foto de perfil redonda com uma bolinha de camera no canto, para a tela de
 * administradores. Mesmo caminho da capa do livro (camera, galeria, recorte e
 * Cloudinary), mas com recorte quadrado - o app mostra a foto redonda.
 *
 * Props:
 *  - src: o que mostrar agora (foto recem-recortada ou a ja salva)
 *  - name: nome da pessoa (as iniciais aparecem quando nao ha foto)
 *  - onPhoto(dataUri): foto pronta (recortada em 400x400)
 *  - onRemove(): ficar sem foto
 *  - notify(message, tone): avisos na tela
 */
export default function PhotoPicker({ src, name, onPhoto, onRemove, notify }) {
  const anchorRef = useRef(null);
  const menuRef = useRef(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const [editorFile, setEditorFile] = useState(null);

  // Fecha o menu ao tocar fora dele ou com Esc (so o menu, nao o modal todo).
  useEffect(() => {
    if (!menuOpen) return undefined;

    function onPointerDown(event) {
      if (anchorRef.current && !anchorRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setMenuOpen(false);
        anchorRef.current?.querySelector("button")?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    // "capture" para rodar antes do Esc do Modal e impedir que ele feche junto.
    document.addEventListener("keydown", onKeyDown, true);
    menuRef.current?.querySelector("button")?.focus();

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [menuOpen]);

  function takePhoto() {
    setMenuOpen(false);
    if (!isTouchDevice() && navigator.mediaDevices?.getUserMedia) {
      setWebcamOpen(true);
    } else {
      cameraInputRef.current?.click();
    }
  }

  function handleFile(event) {
    const file = event.target.files && event.target.files[0];
    // Limpa para que escolher o mesmo arquivo de novo tambem dispare o evento.
    event.target.value = "";
    if (!file) return;
    if (file.type && !file.type.startsWith("image/")) {
      notify("Escolha um arquivo de imagem (JPG, PNG…).", "error");
      return;
    }
    setEditorFile(file);
  }

  return (
    <div className="photopicker">
      <div className="photopicker__anchor" ref={anchorRef}>
        <Avatar src={src} name={name} size={104} />
        <button
          type="button"
          className="coverpicker__camera photopicker__camera"
          aria-label="Alterar foto de perfil"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <IconCamera width={18} height={18} />
        </button>

        {menuOpen ? (
          <div
            className="coverpicker__menu"
            role="menu"
            aria-label="Foto de perfil"
            ref={menuRef}
          >
            <button
              type="button"
              role="menuitem"
              className="coverpicker__item"
              onClick={takePhoto}
            >
              <IconCamera width={18} height={18} />
              Tirar foto
            </button>
            <button
              type="button"
              role="menuitem"
              className="coverpicker__item"
              onClick={() => {
                setMenuOpen(false);
                galleryInputRef.current?.click();
              }}
            >
              <IconImage width={18} height={18} />
              Escolher da galeria
            </button>
            {src ? (
              <>
                <div className="coverpicker__sep" role="separator" />
                <button
                  type="button"
                  role="menuitem"
                  className="coverpicker__item coverpicker__item--danger"
                  onClick={() => {
                    setMenuOpen(false);
                    onRemove();
                  }}
                >
                  <IconTrash width={18} height={18} />
                  Remover foto
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Camera nativa do celular (a da frente, para foto de perfil) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        hidden
        onChange={handleFile}
      />
      {/* Galeria / arquivos */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleFile}
      />

      {/* Os modais vao para o <body> para ficarem por cima do formulario. */}
      {createPortal(
        <>
          <WebcamCapture
            open={webcamOpen}
            facingMode="user"
            hint="Enquadre o rosto. No próximo passo você ajusta o recorte."
            onClose={() => setWebcamOpen(false)}
            onError={() => {
              setWebcamOpen(false);
              notify(
                "Não foi possível abrir a câmera. Libere o acesso no navegador ou escolha uma foto da galeria.",
                "error",
              );
            }}
            onCapture={(blob) => {
              setWebcamOpen(false);
              setEditorFile(blob);
            }}
          />
          <CoverEditor
            open={Boolean(editorFile)}
            file={editorFile}
            ratio={1}
            out={{ w: 400, h: 400 }}
            round
            title="Ajustar foto"
            hint="Arraste a foto para centralizar o rosto."
            onCancel={() => setEditorFile(null)}
            onLoadError={() => {
              setEditorFile(null);
              notify(
                "Não foi possível abrir essa imagem. Tente uma foto em JPG ou PNG.",
                "error",
              );
            }}
            onConfirm={(dataUri) => {
              setEditorFile(null);
              onPhoto(dataUri);
            }}
          />
        </>,
        document.body,
      )}
    </div>
  );
}
