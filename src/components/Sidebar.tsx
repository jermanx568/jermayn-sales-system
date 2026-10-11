import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Receipt,
  RotateCcw,
  Tag,
  Gift,
  LogOut,
  Boxes,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const menuItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/pos", icon: ShoppingCart, label: "Punto de Venta" },
  { to: "/productos", icon: Package, label: "Productos" },
  { to: "/lotes", icon: Boxes, label: "Lotes" },
  { to: "/ventas", icon: Receipt, label: "Ventas" },
  { to: "/devoluciones", icon: RotateCcw, label: "Devoluciones" },
  { to: "/ofertas", icon: Tag, label: "Ofertas" },
  { to: "/combos", icon: Gift, label: "Combos" },
  { to: "/categorias", icon: Tag, label: "Categorias" },
];

export default function Sidebar() {
  const { user, cerrarSesion } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <ShoppingCart size={22} strokeWidth={2.2} />
        </div>
        <div>
          <div className="sidebar-logo-titulo">POS Ventas</div>
          <div className="sidebar-logo-sub">Sistema interno</div>
        </div>
      </div>

      <nav className="sidebar-menu">
        {menuItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              "sidebar-item" + (isActive ? " activo" : "")
            }
          >
            <item.icon size={18} strokeWidth={2} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {user?.email?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-email">{user?.email}</div>
            <div className="sidebar-user-rol">Usuario</div>
          </div>
        </div>
        <button className="sidebar-logout" onClick={cerrarSesion}>
          <LogOut size={16} strokeWidth={2} />
          <span>Cerrar sesion</span>
        </button>
      </div>
    </aside>
  );
}