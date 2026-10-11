import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

type TipoToast = "exito" | "error" | "info";

interface Toast {
  id: number;
  tipo: TipoToast;
  mensaje: string;
}

interface ToastContextType {
  exito: (mensaje: string) => void;
  error: (mensaje: string) => void;
  info: (mensaje: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const agregar = useCallback((tipo: TipoToast, mensaje: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, tipo, mensaje }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const quitar = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const valor = {
    exito: (m: string) => agregar("exito", m),
    error: (m: string) => agregar("error", m),
    info: (m: string) => agregar("info", m),
  };

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tipo}`}>
            <div className="toast-icono">
              {t.tipo === "exito" && <CheckCircle size={20} />}
              {t.tipo === "error" && <AlertCircle size={20} />}
              {t.tipo === "info" && <Info size={20} />}
            </div>
            <div className="toast-mensaje">{t.mensaje}</div>
            <button className="toast-cerrar" onClick={() => quitar(t.id)}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast debe usarse dentro de ToastProvider");
  }
  return context;
}