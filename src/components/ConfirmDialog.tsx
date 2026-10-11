import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
  cargando?: boolean;
}

export default function ConfirmDialog({
  abierto,
  titulo,
  mensaje,
  textoConfirmar = "Eliminar",
  onConfirmar,
  onCancelar,
  cargando = false,
}: ConfirmDialogProps) {
  if (!abierto) return null;

  return (
    <div className="modal-overlay" onClick={onCancelar}>
      <div
        className="modal-content modal-confirm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-icono">
          <AlertTriangle size={28} />
        </div>
        <h3 className="confirm-titulo">{titulo}</h3>
        <p className="confirm-mensaje">{mensaje}</p>
        <div className="modal-acciones">
          <button
            type="button"
            className="btn-secundario"
            onClick={onCancelar}
            disabled={cargando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-peligro"
            onClick={onConfirmar}
            disabled={cargando}
          >
            {cargando ? "Eliminando..." : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}