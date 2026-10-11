import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ShoppingCart,
  LayoutDashboard,
  Package,
  Boxes,
  Receipt,
  RotateCcw,
  Tag,
  Gift,
  ArrowRight,
  Check,
  Star,
  Shield,
  Zap,
  TrendingUp,
  Users,
} from "lucide-react";
import "./Landing.css";

const modulos = [
  {
    icon: LayoutDashboard,
    titulo: "Dashboard",
    descripcion: "Visualiza métricas clave: ventas, facturas, ganancias y más.",
  },
  {
    icon: ShoppingCart,
    titulo: "Punto de Venta",
    descripcion: "Registra ventas con carrito, descuentos y múltiples métodos de pago.",
  },
  {
    icon: Package,
    titulo: "Productos",
    descripcion: "Controla tu catálogo con precios, categorías y stock mínimo.",
  },
  {
    icon: Boxes,
    titulo: "Lotes y FIFO",
    descripcion: "Gestiona entradas por lotes con fechas de vencimiento y salida FIFO.",
  },
  {
    icon: Receipt,
    titulo: "Ventas",
    descripcion: "Historial completo de facturas con filtros y detalles de cada transacción.",
  },
  {
    icon: RotateCcw,
    titulo: "Devoluciones",
    descripcion: "Gestiona devoluciones con notas de crédito y reingreso al inventario.",
  },
  {
    icon: Tag,
    titulo: "Ofertas",
    descripcion: "Crea descuentos automáticos por cantidad, categoría o vigencia.",
  },
  {
    icon: Gift,
    titulo: "Combos",
    descripcion: "Arma paquetes de productos con precios especiales.",
  },
];

const razones = [
  {
    icon: Shield,
    titulo: "Control total",
    descripcion: "Gestiona inventario, precios y stock desde un solo lugar.",
  },
  {
    icon: Zap,
    titulo: "Rápido y eficiente",
    descripcion: "Registra ventas en segundos con interfaz optimizada.",
  },
  {
    icon: TrendingUp,
    titulo: "Trazabilidad FIFO",
    descripcion: "Cada venta descuenta del lote más antiguo automáticamente.",
  },
  {
    icon: Users,
    titulo: "Multiusuario",
    descripcion: "Autenticación segura con roles para tu equipo de trabajo.",
  },
];

const testimonios = [
  {
    nombre: "María González",
    rol: "Dueña de Minimarket",
    texto:
      "Desde que uso este sistema, controlar mi inventario es mucho más fácil. Las alertas de vencimiento me salvaron de perder mercancía.",
  },
  {
    nombre: "Carlos Rivas",
    rol: "Administrador de Farmacia",
    texto:
      "El control FIFO es excelente. Ahora sé exactamente qué lote despachar primero y evito pérdidas por vencimiento.",
  },
  {
    nombre: "Andrea Pérez",
    rol: "Gerente de Tienda",
    texto:
      "Las ofertas automáticas aumentaron mis ventas un 30%. Ya no tengo que estar calculando descuentos manualmente.",
  },
];

const precios = [
  {
    nombre: "Básico",
    descripcion: "Para emprendedores",
    monto: "0",
    periodo: "Gratis por siempre",
    features: [
      "1 usuario",
      "Hasta 100 productos",
      "Punto de venta básico",
      "Historial de ventas",
    ],
    destacado: false,
  },
  {
    nombre: "Profesional",
    descripcion: "Para negocios en crecimiento",
    monto: "29",
    periodo: "por mes",
    features: [
      "Usuarios ilimitados",
      "Productos ilimitados",
      "Control de lotes FIFO",
      "Ofertas y combos",
      "Reportes avanzados",
      "Soporte prioritario",
    ],
    destacado: true,
  },
  {
    nombre: "Empresarial",
    descripcion: "Para cadenas y franquicias",
    monto: "99",
    periodo: "por mes",
    features: [
      "Todo lo del plan Profesional",
      "Múltiples sucursales",
      "API de integración",
      "Backups automáticos",
      "Soporte 24/7",
    ],
    destacado: false,
  },
];

export default function Landing() {
const [moduloClic, setModuloClic] = useState<number | null>(null);

const handleModuloClic = (index: number) => {
  setModuloClic(index);
  setTimeout(() => setModuloClic(null), 1200);
};
    return (
    <div className="landing">
      {/* ===== HEADER PÚBLICO ===== */}
      <header className="landing-header">
        <div className="landing-header-content">
          <div className="landing-logo">
  <div className="landing-logo-icon">
    <span className="landing-logo-texto">JSS</span>
  </div>
  <div className="landing-logo-marca">
    <div className="landing-logo-nombre">Jermayn Sales System</div>
    <div className="landing-logo-tagline">Sistema POS profesional</div>
  </div>
</div>

          <nav className="landing-nav">
            <a href="#modulos">Módulos</a>
            <a href="#razones">Beneficios</a>
            <a href="#precios">Precios</a>
            <Link to="/login">Iniciar sesión</Link>
            <Link to="/register" className="btn-nav-primario">
              Registrarse
            </Link>
          </nav>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="hero-badge-dot"></span>
            Sistema profesional de punto de venta
          </div>

          <h1>
            Gestiona tu negocio con <span className="gradiente">control total</span>
          </h1>

          <p className="hero-sub">
            Sistema POS completo con inventario, ventas, control FIFO de lotes,
            ofertas automáticas y reportes en tiempo real. Todo en un solo lugar.
          </p>

          <div className="hero-botones">
            <Link to="/register" className="btn-hero btn-hero-primario">
              Comenzar gratis
              <ArrowRight size={18} />
            </Link>
            <a href="#modulos" className="btn-hero btn-hero-secundario">
              Ver características
            </a>
          </div>

          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-valor">8</div>
              <div className="hero-stat-label">Módulos integrados</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-valor">100%</div>
              <div className="hero-stat-label">Web y responsive</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-valor">24/7</div>
              <div className="hero-stat-label">Disponibilidad</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-valor">∞</div>
              <div className="hero-stat-label">Productos</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== MÓDULOS ===== */}
      <section className="seccion" id="modulos">
        <div className="seccion-content">
          <div className="seccion-header">
            <h2>Todo lo que tu negocio necesita</h2>
            <p>
              Módulos diseñados para cubrir cada aspecto de la operación diaria
              de tu punto de venta.
            </p>
          </div>

          <div className="modulos-grid">
            {modulos.map((m, i) => (
  <div
    key={i}
    className={"modulo-card" + (moduloClic === i ? " clic" : "")}
    onClick={() => handleModuloClic(i)}
  >
    <div className="modulo-icon">
      <m.icon size={24} strokeWidth={2} />
    </div>
    <h3>{m.titulo}</h3>
    <p>{m.descripcion}</p>
  </div>
))}

            ))
          </div>
        </div>
      </section>

      {/* ===== RAZONES ===== */}
      <section className="seccion seccion-gris" id="razones">
        <div className="seccion-content">
          <div className="seccion-header">
            <h2>¿Por qué elegir este sistema?</h2>
            <p>
              Diseñado por y para comerciantes que necesitan eficiencia, control
              y confiabilidad.
            </p>
          </div>

          <div className="razones-grid">
            {razones.map((r, i) => (
              <div key={i} className="razon-card">
                <div className="razon-icon">
                  <r.icon size={20} strokeWidth={2.2} />
                </div>
                <div>
                  <h4>{r.titulo}</h4>
                  <p>{r.descripcion}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIOS ===== */}
      <section className="seccion">
        <div className="seccion-content">
          <div className="seccion-header">
            <h2>Lo que dicen nuestros usuarios</h2>
            <p>Comercios de todos los tamaños confían en nuestro sistema.</p>
          </div>

          <div className="testimonios-grid">
            {testimonios.map((t, i) => (
              <div key={i} className="testimonio-card">
                <div className="testimonio-estrellas">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} size={16} fill="currentColor" strokeWidth={0} />
                  ))}
                </div>
                <p className="testimonio-texto">"{t.texto}"</p>
                <div className="testimonio-autor">
                  <div className="testimonio-avatar">{t.nombre.charAt(0)}</div>
                  <div>
                    <div className="testimonio-nombre">{t.nombre}</div>
                    <div className="testimonio-rol">{t.rol}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRECIOS ===== */}
      <section className="seccion seccion-gris" id="precios">
        <div className="seccion-content">
          <div className="seccion-header">
            <h2>Planes para cada negocio</h2>
            <p>Comienza gratis y crece cuando tu negocio lo necesite.</p>
          </div>

          <div className="precios-grid">
            {precios.map((p, i) => (
              <div
                key={i}
                className={"precio-card" + (p.destacado ? " destacado" : "")}
              >
                {p.destacado && (
                  <div className="precio-badge-destacado">Más popular</div>
                )}

                <div className="precio-nombre">{p.nombre}</div>
                <div className="precio-descripcion">{p.descripcion}</div>

                <div className="precio-monto">
                  <span>$</span>
                  {p.monto}
                </div>
                <div className="precio-periodo">{p.periodo}</div>

                <ul className="precio-features">
                  {p.features.map((f, j) => (
                    <li key={j}>
                      <Check size={16} strokeWidth={3} />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  to="/register"
                  className={
                    "precio-btn " +
                    (p.destacado ? "precio-btn-primario" : "precio-btn-secundario")
                  }
                  style={{ display: "block", textAlign: "center" }}
                >
                  Comenzar
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA FINAL ===== */}
      <section className="cta-final">
        <div className="cta-final-content">
          <h2>¿Listo para llevar tu negocio al siguiente nivel?</h2>
          <p>
            Únete a los comercios que ya gestionan su punto de venta de forma
            profesional.
          </p>
          <Link to="/register" className="btn-hero btn-hero-primario">
            Comenzar gratis
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="landing-footer">
        <div className="landing-footer-content">
          <div className="landing-footer-top">
            <div>
              <div className="landing-footer-marca">
  <div className="landing-logo-icon" style={{ width: 32, height: 32 }}>
    <span className="landing-logo-texto" style={{ fontSize: 14 }}>JSS</span>
  </div>
  J SYSTEM
</div>
              <p className="landing-footer-texto">
                Sistema de punto de venta profesional con control de inventario,
                ventas, lotes FIFO y reportes en tiempo real.
              </p>
            </div>

            <div className="landing-footer-col">
              <h4>Producto</h4>
              <a href="#modulos">Módulos</a>
              <a href="#razones">Beneficios</a>
              <a href="#precios">Precios</a>
            </div>

            <div className="landing-footer-col">
              <h4>Cuenta</h4>
              <Link to="/login">Iniciar sesión</Link>
              <Link to="/register">Registrarse</Link>
            </div>

            <div className="landing-footer-col">
              <h4>Soporte</h4>
              <a href="#">Centro de ayuda</a>
              <a href="#">Contacto</a>
              <a href="#">Términos</a>
            </div>
          </div>

          <div className="landing-footer-bottom">
            © 2026 POS Ventas · Desarrollado por Jermayn Miquilena
          </div>
        </div>
      </footer>
    </div>
  );
}