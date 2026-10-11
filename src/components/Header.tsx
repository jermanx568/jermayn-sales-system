import { useLocation } from "react-router-dom";
import { Bell } from "lucide-react";

const titulos: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/pos": "Punto de Venta",
  "/productos": "Productos",
  "/categorias": "Categorías",
  "/lotes": "Lotes y Vencimientos",
  "/ventas": "Historial de Ventas",
  "/devoluciones": "Devoluciones",
  "/ofertas": "Ofertas y Descuentos",
  "/combos": "Combos",
};

export default function Header() {
  const location = useLocation();
  const titulo = titulos[location.pathname] || "Jermayn Sales System";

  return (
    <header className="header">
      <div className="header-titulo">
        <h1>{titulo}</h1>
      </div>

      <div className="header-acciones">
        <button className="header-icono" title="Notificaciones">
          <Bell size={18} strokeWidth={2} />
        </button>
      </div>
    </header>
  );
}