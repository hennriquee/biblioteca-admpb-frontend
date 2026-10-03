import { useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import { IconCamera } from "./Icons.jsx";

/**
 * Camera ao vivo para computador (no celular usamos a camera do proprio
 * aparelho, via <input capture>). Mostra a imagem da webcam, e ao tocar em
 * "Capturar" devolve a foto como Blob para a tela de ajuste da capa.
 *
 * Props:
 *  - onCapture(blob): foto tirada
 *  - onClose(): fechar sem tirar foto
 *  - onError(error): nao foi possivel abrir a camera (sem permissao, sem webcam…)
 */
export default function WebcamCapture({ open, onClose, onCapture, onError }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
      } catch (error) {
        if (!cancelled && onErrorRef.current) onErrorRef.current(error);
      }
    }

    start();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setReady(false);
    };
  }, [open]);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob);
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tirar foto"
      closeOnBackdrop={false}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={capture}
            disabled={!ready}
          >
            <IconCamera width={17} height={17} />
            Capturar
          </button>
        </>
      }
    >
      <div className="webcam">
        <video
          ref={videoRef}
          className="webcam__video"
          autoPlay
          playsInline
          muted
          onLoadedData={() => setReady(true)}
        />
        {!ready ? <p className="webcam__status muted">Abrindo a câmera…</p> : null}
      </div>
      <p className="cropper__hint muted">
        Enquadre a capa do livro. No próximo passo você ajusta o recorte.
      </p>
    </Modal>
  );
}
