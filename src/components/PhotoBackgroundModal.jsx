import { useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import {
  DEFAULT_PHOTO_BACKGROUND,
  PHOTO_BACKGROUNDS,
  findPhotoBackground,
  flattenPhotoBackground,
} from "../utils/photoBackgrounds.js";

/**
 * "Fundo da foto": a pessoa clica numa bolinha de cor e ve na hora como a
 * propria foto vai ficar. Aparece depois do recorte, so na tela Minha conta
 * (ver PhotoPicker.jsx).
 *
 * A foto que chega aqui e o PNG sem fundo. A que sai e ela JA COLADA sobre a
 * cor escolhida (JPEG, sem transparencia): e essa que vai para o Cloudinary.
 *
 * Props:
 *  - photo: PNG sem fundo (data URI)
 *  - name: nome de quem esta na foto (para o texto alternativo)
 *  - onCancel(): desistir desta foto
 *  - onConfirm(dataUri): foto pronta, com o fundo escolhido
 *  - notify(message, tone): avisos na tela
 */
export default function PhotoBackgroundModal({
  open,
  photo,
  name,
  onCancel,
  onConfirm,
  notify,
}) {
  const [chosen, setChosen] = useState(DEFAULT_PHOTO_BACKGROUND.id);
  const [applying, setApplying] = useState(false);
  const groupRef = useRef(null);

  // Cada foto nova comeca no branco (o fundo que uma foto de perfil precisa
  // ter se a pessoa nao quiser pensar em cor nenhuma).
  useEffect(() => {
    if (!open) return;
    setChosen(DEFAULT_PHOTO_BACKGROUND.id);
    setApplying(false);
  }, [open, photo]);

  const background = findPhotoBackground(chosen);

  // Setas andam pelas bolinhas e Home/End vao para as pontas, como manda um
  // grupo de radio.
  function onKeyDown(event) {
    const last = PHOTO_BACKGROUNDS.length - 1;
    const index = PHOTO_BACKGROUNDS.findIndex((option) => option.id === chosen);
    let target = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      target = index === last ? 0 : index + 1;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      target = index === 0 ? last : index - 1;
    } else if (event.key === "Home") {
      target = 0;
    } else if (event.key === "End") {
      target = last;
    }
    if (target === null) return;

    event.preventDefault();
    const next = PHOTO_BACKGROUNDS[target];
    setChosen(next.id);
    groupRef.current
      ?.querySelector('[data-background="' + next.id + '"]')
      ?.focus();
  }

  async function confirm() {
    if (applying) return;
    setApplying(true);
    try {
      onConfirm(await flattenPhotoBackground(photo, background.color));
    } catch (error) {
      notify(
        error.message || "Não foi possível aplicar o fundo escolhido.",
        "error",
      );
      setApplying(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Fundo da foto"
      size="sm"
      closeOnBackdrop={false}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={confirm}
            disabled={applying}
          >
            {applying ? "Preparando…" : "Usar esta foto"}
          </button>
        </>
      }
    >
      <div className="bgpicker">
        <div
          className="bgpicker__preview"
          style={{ background: background.color }}
        >
          <img src={photo} alt={name ? "Foto de " + name : "Sua foto"} />
        </div>

        <div
          className="bgpicker__dots"
          role="radiogroup"
          aria-label="Cor do fundo da foto"
          ref={groupRef}
          onKeyDown={onKeyDown}
        >
          {PHOTO_BACKGROUNDS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={option.id === chosen}
              aria-label={option.label}
              title={option.label}
              data-background={option.id}
              tabIndex={option.id === chosen ? 0 : -1}
              className="bgpicker__dot"
              style={{ background: option.color }}
              onClick={() => setChosen(option.id)}
            />
          ))}
        </div>

        <p className="bgpicker__hint muted">
          O fundo original saiu da foto. Escolha a cor que fica atrás de você:
          é ela que vai ser salva.
        </p>
      </div>
    </Modal>
  );
}
