import type { ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  children: ReactNode;
}

export default function Modal({ abierto, onCerrar, titulo, children }: ModalProps) {
  if (!abierto) return null;

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{titulo}</h2>
          <button className="modal-cerrar" onClick={onCerrar}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}