import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import BookCover from "./BookCover.jsx";
import CoverEditor from "./CoverEditor.jsx";
import WebcamCapture from "./WebcamCapture.jsx";
import {
  IconCamera,
  IconImage,
  IconSearch,
  IconLink,
  IconTrash,
} from "./Icons.jsx";

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
 * Capa do livro com uma bolinha de camera no canto. Ao tocar nela abre um
 * menu: tirar foto, escolher da galeria, buscar na internet, colar link e
 * remover. A foto escolhida passa por uma tela de recorte (2:3) e so entao
 * volta para o formulario, via onPhoto(dataUri).
 *
 * Props:
 *  - src: o que mostrar na capa (foto recem-recortada ou link ja salvo)
 *  - onPhoto(dataUri): foto pronta (recortada)
 *  - onSearch(): abrir "Buscar foto na internet"
 *  - onToggleLink(): mostrar/esconder o campo de link
 *  - onRemove(): tirar a capa
 *  - notify(message, tone): avisos na tela
 */
export default function CoverPicker({
  src,
  linkOpen,
  onPhoto,
  onSearch,
  onToggleLink,
  onRemove,
  notify,
}) {
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

  function pickFromGallery() {
    setMenuOpen(false);
    galleryInputRef.current?.click();
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

  function handleWebcamError() {
    setWebcamOpen(false);
    notify(
      "Não foi possível abrir a câmera. Libere o acesso no navegador ou escolha uma foto da galeria.",
      "error",
    );
  }

  function handleLoadError() {
    setEditorFile(null);
    notify(
      "Não foi possível abrir essa imagem. Tente uma foto em JPG ou PNG.",
      "error",
    );
  }

  const menuAction = (action) => () => {
    setMenuOpen(false);
    action();
  };

  return (
    <div className="coverpicker">
      <div className="coverpicker__anchor" ref={anchorRef}>
        <BookCover src={src} alt="" className="cover--lg" />
        <button
          type="button"
          className="coverpicker__camera"
          aria-label="Alterar capa do livro"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <IconCamera width={20} height={20} />
        </button>

        {menuOpen ? (
          <div
            className="coverpicker__menu"
            role="menu"
            aria-label="Capa do livro"
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
              onClick={pickFromGallery}
            >
              <IconImage width={18} height={18} />
              Escolher da galeria
            </button>
            <button
              type="button"
              role="menuitem"
              className="coverpicker__item"
              onClick={menuAction(onSearch)}
            >
              <IconSearch width={18} height={18} />
              Buscar na internet
            </button>
            <button
              type="button"
              role="menuitem"
              className="coverpicker__item"
              onClick={menuAction(onToggleLink)}
            >
              <IconLink width={18} height={18} />
              {linkOpen ? "Esconder campo de link" : "Colar link da imagem"}
            </button>
            {src ? (
              <>
                <div className="coverpicker__sep" role="separator" />
                <button
                  type="button"
                  role="menuitem"
                  className="coverpicker__item coverpicker__item--danger"
                  onClick={menuAction(onRemove)}
                >
                  <IconTrash width={18} height={18} />
                  Remover capa
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Camera nativa do celular */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
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
            onClose={() => setWebcamOpen(false)}
            onError={handleWebcamError}
            onCapture={(blob) => {
              setWebcamOpen(false);
              setEditorFile(blob);
            }}
          />
          <CoverEditor
            open={Boolean(editorFile)}
            file={editorFile}
            onCancel={() => setEditorFile(null)}
            onLoadError={handleLoadError}
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
