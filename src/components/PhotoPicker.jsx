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
import { blobHasTransparency, loadSavedImage } from "../utils/savedImage.js";
import {
  IconCamera,
  IconEdit,
  IconImage,
  IconPalette,
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
 * "EDITAR FOTO" abre a foto que ja esta salva (ou a que acabou de ser
 * montada) na mesma tela de recorte de uma foto nova: ampliar, girar e
 * reenquadrar o rosto. Nao passa de novo pelo recorte do fundo - o fundo ja
 * esta resolvido e refazer gastaria uma foto da cota por nada. Se a foto
 * salva ainda esta sem fundo (transparente), ela continua assim: sai em PNG,
 * e na propria foto do administrador segue para a escolha da cor.
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
 * recorte existir. A espera tambem tem saida: o passo "Preparando a foto"
 * traz "Usar com o fundo original" para quem nao quiser esperar.
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
  // { file, saved, alpha }: saved = e a foto que ja estava no perfil, nao uma
  // nova; alpha = ela tem partes transparentes (foto sem fundo).
  const [editor, setEditor] = useState(null);
  // Buscando a foto atual para editar.
  const [opening, setOpening] = useState(false);
  // Cancela a busca da foto atual: ao desistir (ou fechar o formulario), o
  // download para na hora e uma foto que chegue atrasada e ignorada.
  const abortRef = useRef(null);
  // A foto que a pessoa ja tinha continua valendo se ela desistir da etapa
  // do fundo (veio de "Editar foto" ou "Mudar o fundo"): o aviso muda.
  const keepsPhotoRef = useRef(false);
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
      abortRef.current?.abort();
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
    // Celular deitado: o menu pode passar da borda da janela do formulario.
    menuRef.current?.scrollIntoView({ block: "nearest" });

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
    keepsPhotoRef.current = false;
    setEditor({ file, saved: false, alpha: false });
  }

  async function editCurrent() {
    setMenuOpen(false);
    if (!src) return;
    keepsPhotoRef.current = true;
    // O item do menu que foi clicado vai sumir: sem isto o foco do teclado
    // cairia no fim da pagina. Com a bolinha da camera focada, o Modal a
    // devolve de volta ao fechar o editor (cancelar, Esc, confirmar ou erro).
    anchorRef.current?.querySelector("button")?.focus();
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setOpening(true);
    try {
      const file = await loadSavedImage(src, { signal: controller.signal });
      const alpha = await blobHasTransparency(file);
      if (controller.signal.aborted) return;
      setEditor({ file, saved: true, alpha });
    } catch (error) {
      if (controller.signal.aborted) return;
      notify(error.message, "error");
    }
    setOpening(false);
  }

  function closeEditor() {
    abortRef.current?.abort();
    setOpening(false);
    setEditor(null);
  }

  // Saiu do recorte da foto que ja estava salva: o fundo nao muda, entao a
  // foto segue direto - so a transparente da propria pessoa ainda precisa
  // escolher a cor que vai atras.
  function handleEdited(dataUri) {
    const transparent = Boolean(editor?.alpha);
    setEditor(null);
    if (transparent && chooseBackground) {
      setCutout(dataUri);
      return;
    }
    onPhoto(dataUri);
  }

  // Saiu do recorte quadrado: tira o fundo antes de a foto seguir viagem.
  async function handleCropped(dataUri) {
    setEditor(null);
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
    keepsPhotoRef.current = true;

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
            {src ? (
              <button
                type="button"
                role="menuitem"
                className="coverpicker__item"
                onClick={editCurrent}
              >
                <IconEdit width={18} height={18} />
                Editar foto
              </button>
            ) : null}
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
              keepsPhotoRef.current = false;
              setEditor({ file: blob, saved: false, alpha: false });
            }}
          />
          <CoverEditor
            open={Boolean(editor) || opening}
            file={editor ? editor.file : null}
            loading={opening}
            keepAlpha={Boolean(editor?.alpha)}
            ratio={1}
            out={{ w: 400, h: 400 }}
            round
            title={opening || editor?.saved ? "Editar foto" : "Ajustar foto"}
            hint={
              opening || editor?.saved
                ? "Arraste, amplie ou gire a foto para reenquadrar."
                : "Arraste a foto para centralizar o rosto."
            }
            onCancel={closeEditor}
            onLoadError={() => {
              const saved = editor?.saved;
              closeEditor();
              notify(
                saved
                  ? "Não foi possível abrir essa foto para editar. Escolha uma nova."
                  : "Não foi possível abrir essa imagem. Tente uma foto em JPG ou PNG.",
                "error",
              );
            }}
            onConfirm={editor?.saved ? handleEdited : handleCropped}
          />
          {/* A espera fica num passo proprio, e nao atras de um girador na
              foto, para o formulario nao poder ser salvo no meio dela (sairia
              sem a foto nova). "Cancelar" (tambem o "x" e o Esc) desiste da
              foto; o outro botao leva a foto com o fundo original. */}
          <Modal
            open={cutting}
            onClose={cancelCutout}
            title="Preparando a foto"
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
                Preparando a foto para editar
                <span className="loadingdots" aria-hidden="true">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
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
              notify(
                keepsPhotoRef.current
                  ? "Nada foi alterado. A foto continua a mesma."
                  : "A foto foi descartada.",
                "info",
              );
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
