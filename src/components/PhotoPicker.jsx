import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Avatar from "./Avatar.jsx";
import Modal from "./Modal.jsx";
import CoverEditor from "./CoverEditor.jsx";
import WebcamCapture from "./WebcamCapture.jsx";
import PhotoBackgroundModal from "./PhotoBackgroundModal.jsx";
import {
  fetchPhotoCutout,
  photoCutoutBlockedReason,
} from "../api/photoCutout.js";
import { readSavedPhoto } from "../utils/photoBackgrounds.js";
import { IconCamera, IconImage, IconPalette, IconTrash } from "./Icons.jsx";

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
 * O FUNDO DA FOTO sai sempre: depois do recorte quadrado, o servidor recorta
 * a pessoa e devolve um PNG transparente (ver api/photoCutout.js). O que
 * acontece com esse PNG depende de quem e a foto:
 *
 * - foto de outra pessoa do cadastro (telas Usuarios e manutencao): vai assim
 *   mesmo, transparente, e aparece sobre o fundo redondo do proprio app;
 * - a PROPRIA foto do administrador (chooseBackground, tela Minha conta): abre
 *   o "Fundo da foto", onde ele escolhe a cor nas bolinhas e ve na hora como
 *   fica. A foto salva ja vai com essa cor atras.
 *
 * QUEM VIROU ADMINISTRADOR E JA TINHA FOTO nao precisa tirar outra: com
 * chooseBackground, o menu ganha "Mudar o fundo", que pega a foto que esta
 * salva e abre a escolha de cor. Se essa foto ja estiver sem fundo (foi
 * tirada quando a pessoa era usuaria) ou se ela acabou de ser montada aqui,
 * trocar a cor NAO gasta nada da cota: o recorte ja existe. So a foto que
 * tem fundo precisa passar pelo recorte outra vez.
 *
 * SE O RECORTE FALHAR (cota do mes no fim, chave ausente, servico fora do
 * ar), nada trava: o app avisa e segue com a foto do jeito que ela foi
 * enquadrada, com o fundo original - era assim que funcionava antes de o
 * recorte existir. A espera tambem tem saida: o passo "Tirando o fundo da
 * foto" traz "Usar com o fundo original" para quem nao quiser esperar.
 *
 * Props:
 *  - src: o que mostrar agora (foto recem-recortada ou a ja salva)
 *  - name: nome da pessoa (as iniciais aparecem quando nao ha foto)
 *  - onPhoto(dataUri): foto pronta (recortada em 400x400)
 *  - onRemove(): ficar sem foto
 *  - notify(message, tone): avisos na tela
 *  - chooseBackground: deixa escolher a cor do fundo (a propria foto)
 *  - dev: a tela de manutencao usa as rotas /api/dev
 */
export default function PhotoPicker({
  src,
  name,
  onPhoto,
  onRemove,
  notify,
  chooseBackground = false,
  dev = false,
}) {
  const anchorRef = useRef(null);
  const menuRef = useRef(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const [editorFile, setEditorFile] = useState(null);
  // Recorte do fundo em andamento (vai e volta do servidor).
  const [cutting, setCutting] = useState(false);
  // PNG sem fundo esperando a escolha da cor (so quando chooseBackground).
  const [cutout, setCutout] = useState("");

  // A foto como saiu do recorte quadrado, com o fundo original: e ela que
  // vale se o recorte do fundo falhar ou a pessoa nao quiser esperar.
  const originalRef = useRef("");
  // Muda a cada espera; uma resposta que chegue depois de a pessoa desistir
  // carrega um numero velho e e ignorada.
  const waitRef = useRef(0);
  // O ultimo par { recorte, foto montada } desta visita. Serve para trocar a
  // cor de novo sem gastar outra foto da cota: o recorte ainda esta aqui.
  const lastRef = useRef(null);
  // O formulario pode ser fechado durante a espera; depois disso nao ha mais
  // a quem entregar foto nenhuma.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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

  // Saiu do recorte quadrado: tira o fundo antes de a foto seguir viagem.
  async function handleCropped(dataUri) {
    setEditorFile(null);
    originalRef.current = dataUri;

    // Esta visita ja descobriu que o recorte nao vai acontecer (sem chave,
    // chave recusada ou cota no fim). Nem abre a espera: avisa e segue com a
    // foto como ela esta.
    const blocked = photoCutoutBlockedReason();
    if (blocked) {
      notify(blocked + " A foto vai ser salva com o fundo original.", "error");
      onPhoto(dataUri);
      return;
    }

    const wait = waitRef.current + 1;
    waitRef.current = wait;
    setCutting(true);

    let transparent = "";
    try {
      transparent = await fetchPhotoCutout(dataUri, { dev });
    } catch (error) {
      // Desistiu da espera ou fechou o formulario: nao ha o que avisar.
      if (wait !== waitRef.current || !mountedRef.current) return;
      notify(
        (error.message || "Não foi possível remover o fundo da foto.") +
          " A foto vai ser salva com o fundo original.",
        "error",
      );
    }
    if (wait !== waitRef.current || !mountedRef.current) return;

    setCutting(false);
    if (!transparent) {
      onPhoto(dataUri);
      return;
    }
    if (chooseBackground) {
      setCutout(transparent);
      return;
    }
    onPhoto(transparent);
  }

  // "Usar com o fundo original": nao espera mais o recorte e segue com a foto
  // do jeito que ela foi enquadrada. (A foto que ja foi mandada ao servico
  // continua contando na cota - o que se ganha aqui e tempo.)
  function skipCutout() {
    waitRef.current += 1;
    setCutting(false);
    const original = originalRef.current;
    if (original) onPhoto(original);
  }

  // Desistir da foto no meio da espera: nada e entregue ao formulario.
  function cancelCutout() {
    waitRef.current += 1;
    setCutting(false);
  }

  // "Mudar o fundo": troca a cor da foto QUE JA ESTA SALVA (ou da que acabou
  // de ser montada aqui), sem precisar tirar outra.
  async function changeBackground() {
    setMenuOpen(false);
    if (!src) return;

    // Foi esta tela que montou a foto de agora: o recorte dela esta na mao,
    // entao trocar de cor nao custa nada.
    const last = lastRef.current;
    if (last && last.photo === src) {
      setCutout(last.cutout);
      return;
    }

    let saved;
    try {
      saved = await readSavedPhoto(src);
    } catch (error) {
      notify(
        error.message || "Não foi possível ler a foto que está salva.",
        "error",
      );
      return;
    }
    if (!mountedRef.current) return;

    // Foto salva sem fundo (tirada quando a pessoa era usuaria): a cor entra
    // direto, sem gastar nada da cota.
    if (saved.transparent) {
      setCutout(saved.dataUri);
      return;
    }
    // Foto com fundo: a unica forma de trocar e recortar de novo.
    handleCropped(saved.dataUri);
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
            {chooseBackground && src ? (
              <button
                type="button"
                role="menuitem"
                className="coverpicker__item"
                onClick={changeBackground}
              >
                <IconPalette width={18} height={18} />
                Mudar o fundo
              </button>
            ) : null}
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
            onConfirm={handleCropped}
          />
          {/* A espera fica num passo proprio, e nao atras de um girador na
              foto, para o formulario nao poder ser salvo no meio dela (sairia
              sem a foto nova). "Cancelar" (tambem o "x" e o Esc) desiste da
              foto; o outro botao leva a foto com o fundo original. */}
          <Modal
            open={cutting}
            onClose={cancelCutout}
            title="Tirando o fundo da foto"
            size="sm"
            closeOnBackdrop={false}
            footer={
              <>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={cancelCutout}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={skipCutout}
                >
                  Usar com o fundo original
                </button>
              </>
            }
          >
            <div className="photocut">
              <span className="photocut__spin" aria-hidden="true" />
              <p className="muted" role="status">
                Isso leva alguns segundos: o servidor está separando você do
                fundo da foto.
              </p>
            </div>
          </Modal>
          <PhotoBackgroundModal
            open={Boolean(cutout)}
            photo={cutout}
            name={name}
            notify={notify}
            onCancel={() => {
              setCutout("");
              notify("A foto foi descartada.", "info");
            }}
            onConfirm={(dataUri) => {
              // Guarda o recorte junto da foto montada: se a pessoa quiser
              // outra cor em seguida, nao ha nova chamada ao servico.
              lastRef.current = { cutout, photo: dataUri };
              setCutout("");
              onPhoto(dataUri);
            }}
          />
        </>,
        document.body,
      )}
    </div>
  );
}
