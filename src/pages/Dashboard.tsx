import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Receipt,
  AlertTriangle,
  Clock,
  Package,
  Boxes,
  Banknote,
  CreditCard,
  ArrowLeftRight,
  ArrowRight,
  Award,
  Calendar,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";
import { useToast } from "../hooks/useToast";
import type {
  DashboardStats,
  VentaGrafica,
  TopProducto,
  ActividadReciente,
} from "../types";

export default function Dashboard() {
  const toast = useToast();
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats>({
    ventas_hoy: 0,
    facturas_hoy: 0,
    ventas_semana: 0,
    facturas_semana: 0,
    ventas_mes: 0,
    facturas_mes: 0,
    ticket_promedio: 0,
    productos_bajo_stock: 0,
    lotes_por_vencer: 0,
  });
  const [grafica, setGrafica] = useState<VentaGrafica[]>([]);
  const [topProductos, setTopProductos] = useState<TopProducto[]>([]);
  const [actividad, setActividad] = useState<ActividadReciente[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarTodo();
  }, []);

  async function cargarTodo() {
    setCargando(true);
    try {
      await Promise.all([
        cargarStats(),
        cargarGrafica(),
        cargarTopProductos(),
        cargarActividad(),
      ]);
    } catch (err: any) {
      toast.error("Error al cargar dashboard: " + err.message);
    } finally {
      setCargando(false);
    }
  }

  // ==================== STATS ====================
  async function cargarStats() {
    // Ventas de hoy
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const semana = new Date();
    semana.setDate(semana.getDate() - 7);

    const mes = new Date();
    mes.setDate(mes.getDate() - 30);

    const [hoyRes, semanaRes, mesRes, stockRes, vencRes] = await Promise.all([
      supabase
        .from("ventas")
        .select("total")
        .gte("fecha", hoy.toISOString())
        .eq("estado", "completada"),
      supabase
        .from("ventas")
        .select("total")
        .gte("fecha", semana.toISOString())
        .eq("estado", "completada"),
      supabase
        .from("ventas")
        .select("total")
        .gte("fecha", mes.toISOString())
        .eq("estado", "completada"),
      supabase.from("productos").select("id, stock_minimo, activo").eq("activo", true),
      supabase
        .from("lotes")
        .select("id, fecha_vencimiento, cantidad_actual")
        .gt("cantidad_actual", 0)
        .not("fecha_vencimiento", "is", null),
    ]);

    const hoyData = hoyRes.data || [];
    const semanaData = semanaRes.data || [];
    const mesData = mesRes.data || [];

    const ventasHoy = hoyData.reduce((a, v) => a + Number(v.total), 0);
    const ventasSemana = semanaData.reduce((a, v) => a + Number(v.total), 0);
    const ventasMes = mesData.reduce((a, v) => a + Number(v.total), 0);

    const ticketProm =
      mesData.length > 0 ? ventasMes / mesData.length : 0;

    // Stock bajo: necesitamos calcular stock real por producto desde lotes
    const prodData = stockRes.data || [];
    const { data: lotesData } = await supabase
      .from("lotes")
      .select("producto_id, cantidad_actual")
      .gt("cantidad_actual", 0);

    const stockPorProducto = new Map<string, number>();
    (lotesData || []).forEach((l: any) => {
      stockPorProducto.set(
        l.producto_id,
        (stockPorProducto.get(l.producto_id) || 0) + l.cantidad_actual
      );
    });

    const stockBajo = prodData.filter((p: any) => {
      const stockActual = stockPorProducto.get(p.id) || 0;
      return stockActual <= p.stock_minimo;
    }).length;

    // Lotes por vencer (en menos de 7 días)
    const hoyDate = new Date();
    hoyDate.setHours(0, 0, 0, 0);
    const limite = new Date();
    limite.setDate(limite.getDate() + 7);

    const vencProx = (vencRes.data || []).filter((l: any) => {
      const vence = new Date(l.fecha_vencimiento + "T00:00:00");
      return vence >= hoyDate && vence <= limite;
    }).length;

    setStats({
      ventas_hoy: ventasHoy,
      facturas_hoy: hoyData.length,
      ventas_semana: ventasSemana,
      facturas_semana: semanaData.length,
      ventas_mes: ventasMes,
      facturas_mes: mesData.length,
      ticket_promedio: ticketProm,
      productos_bajo_stock: stockBajo,
      lotes_por_vencer: vencProx,
    });
  }

  // ==================== GRAFICA ====================
  async function cargarGrafica() {
    const hace7dias = new Date();
    hace7dias.setDate(hace7dias.getDate() - 6);
    hace7dias.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from("ventas")
      .select("fecha, total")
      .gte("fecha", hace7dias.toISOString())
      .eq("estado", "completada");

    const dias: VentaGrafica[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const fin = new Date(d);
      fin.setHours(23, 59, 59, 999);

      const ventasDia = (data || []).filter((v: any) => {
        const fecha = new Date(v.fecha);
        return fecha >= d && fecha <= fin;
      });

      const totalDia = ventasDia.reduce((a, v) => a + Number(v.total), 0);

      dias.push({
        fecha: d.toISOString(),
        dia_corto: d.toLocaleDateString("es-VE", { weekday: "short" }),
        total: totalDia,
        facturas: ventasDia.length,
      });
    }

    setGrafica(dias);
  }

  // ==================== TOP PRODUCTOS ====================
  async function cargarTopProductos() {
    const hace30dias = new Date();
    hace30dias.setDate(hace30dias.getDate() - 30);

    const { data: ventasData } = await supabase
      .from("ventas")
      .select("id")
      .gte("fecha", hace30dias.toISOString())
      .eq("estado", "completada");

    const ventaIds = (ventasData || []).map((v: any) => v.id);

    if (ventaIds.length === 0) {
      setTopProductos([]);
      return;
    }

    const { data: detalles } = await supabase
      .from("detalle_ventas")
      .select(`
        cantidad,
        subtotal,
        producto_id,
        productos:producto_id (nombre, codigo)
      `)
      .in("venta_id", ventaIds);

    const map = new Map<string, TopProducto>();
    (detalles || []).forEach((d: any) => {
      const key = d.producto_id;
      const existente = map.get(key);
      if (existente) {
        existente.cantidad_vendida += d.cantidad;
        existente.ingreso_total += Number(d.subtotal);
      } else {
        map.set(key, {
          producto_id: d.producto_id,
          nombre: d.productos?.nombre ?? "—",
          codigo: d.productos?.codigo ?? "—",
          cantidad_vendida: d.cantidad,
          ingreso_total: Number(d.subtotal),
        });
      }
    });

    const top = Array.from(map.values())
      .sort((a, b) => b.cantidad_vendida - a.cantidad_vendida)
      .slice(0, 5);

    setTopProductos(top);
  }

  // ==================== ACTIVIDAD RECIENTE ====================
  async function cargarActividad() {
    const { data } = await supabase
      .from("ventas")
      .select("id, numero_factura, total, metodo_pago, fecha")
      .order("fecha", { ascending: false })
      .limit(5);

    const actividad: ActividadReciente[] = (data || []).map((v: any) => ({
      id: v.id,
      numero_factura: v.numero_factura,
      total: Number(v.total),
      metodo_pago: v.metodo_pago,
      fecha: v.fecha,
      hace: tiempoRelativo(v.fecha),
    }));

    setActividad(actividad);
  }

  function tiempoRelativo(fecha: string): string {
    const ahora = new Date();
    const f = new Date(fecha);
    const diff = Math.floor((ahora.getTime() - f.getTime()) / 1000);

    if (diff < 60) return "hace unos segundos";
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
    if (diff < 604800) return `hace ${Math.floor(diff / 86400)} días`;
    return f.toLocaleDateString("es-VE");
  }

  function formatoMoneda(n: number) {
    return "$" + Number(n).toFixed(2);
  }

  function iconoMetodo(metodo: string) {
    if (metodo === "efectivo") return <Banknote size={14} />;
    if (metodo === "tarjeta") return <CreditCard size={14} />;
    return <ArrowLeftRight size={14} />;
  }

  // ==================== RENDER ====================
  return (
    <Layout>
      <div className="page-header">
        <div>
          <h2>Bienvenido al sistema</h2>
          <p>Resumen general de tu punto de venta</p>
        </div>
        <button
          className="btn-primario-chico"
          onClick={() => navigate("/pos")}
        >
          <ShoppingBag size={16} />
          Ir al POS
        </button>
      </div>

      {/* ========== TARJETAS DE KPIs ========== */}
      <div className="grid-cards">
        <div className="card-stat card-stat-primary">
          <div className="card-stat-icono">
            <DollarSign size={20} />
          </div>
          <div className="card-stat-label">Ventas hoy</div>
          <div className="card-stat-valor">{formatoMoneda(stats.ventas_hoy)}</div>
          <div className="card-stat-info">
            {stats.facturas_hoy} factura{stats.facturas_hoy !== 1 ? "s" : ""}
          </div>
        </div>

        <div className="card-stat">
          <div className="card-stat-icono card-stat-icono-green">
            <TrendingUp size={20} />
          </div>
          <div className="card-stat-label">Últimos 7 días</div>
          <div className="card-stat-valor">{formatoMoneda(stats.ventas_semana)}</div>
          <div className="card-stat-info">
            {stats.facturas_semana} factura{stats.facturas_semana !== 1 ? "s" : ""}
          </div>
        </div>

        <div className="card-stat">
          <div className="card-stat-icono card-stat-icono-purple">
            <Receipt size={20} />
          </div>
          <div className="card-stat-label">Últimos 30 días</div>
          <div className="card-stat-valor">{formatoMoneda(stats.ventas_mes)}</div>
          <div className="card-stat-info">
            {stats.facturas_mes} factura{stats.facturas_mes !== 1 ? "s" : ""}
          </div>
        </div>

        <div className="card-stat">
          <div className="card-stat-icono card-stat-icono-orange">
            <Award size={20} />
          </div>
          <div className="card-stat-label">Ticket promedio</div>
          <div className="card-stat-valor">{formatoMoneda(stats.ticket_promedio)}</div>
          <div className="card-stat-info">Promedio 30 días</div>
        </div>
      </div>

      {/* ========== ALERTAS ========== */}
      {(stats.productos_bajo_stock > 0 || stats.lotes_por_vencer > 0) && (
        <div className="dashboard-alertas">
          <div className="dashboard-alertas-titulo">
            <AlertTriangle size={18} />
            <span>Atención requerida</span>
          </div>
          <div className="dashboard-alertas-items">
            {stats.productos_bajo_stock > 0 && (
              <button
                className="dashboard-alerta dashboard-alerta-warning"
                onClick={() => navigate("/productos")}
              >
                <Package size={16} />
                <div>
                  <strong>{stats.productos_bajo_stock}</strong> producto
                  {stats.productos_bajo_stock !== 1 ? "s" : ""} con stock bajo
                </div>
                <ArrowRight size={16} />
              </button>
            )}

            {stats.lotes_por_vencer > 0 && (
              <button
                className="dashboard-alerta dashboard-alerta-danger"
                onClick={() => navigate("/lotes")}
              >
                <Boxes size={16} />
                <div>
                  <strong>{stats.lotes_por_vencer}</strong> lote
                  {stats.lotes_por_vencer !== 1 ? "s" : ""} por vencer en 7 días
                </div>
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ========== GRÁFICA + TOP PRODUCTOS ========== */}
      <div className="dashboard-grid-2">
        <div className="card-panel">
          <div className="dashboard-panel-header">
            <div>
              <h3>Ventas últimos 7 días</h3>
              <p>Total facturado por día</p>
            </div>
            <span className="dashboard-panel-badge">
              {formatoMoneda(grafica.reduce((a, g) => a + g.total, 0))}
            </span>
          </div>

          {cargando ? (
            <p className="texto-vacio">Cargando gráfica...</p>
          ) : grafica.every((g) => g.total === 0) ? (
            <div className="dashboard-grafica-vacia">
              <Calendar size={32} strokeWidth={1.2} />
              <p>Sin ventas en los últimos 7 días</p>
            </div>
          ) : (
            <div className="dashboard-grafica">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={grafica}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="dia_corto"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      fontSize: 12,
                    }}
                    formatter={(v: any) => [`$${Number(v).toFixed(2)}`, "Ventas"]}
                  />
                  <Bar
                    dataKey="total"
                    fill="#2563eb"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card-panel">
          <div className="dashboard-panel-header">
            <div>
              <h3>Top 5 productos</h3>
              <p>Más vendidos (últimos 30 días)</p>
            </div>
          </div>

          {cargando ? (
            <p className="texto-vacio">Cargando...</p>
          ) : topProductos.length === 0 ? (
            <div className="dashboard-grafica-vacia">
              <Package size={32} strokeWidth={1.2} />
              <p>Sin ventas registradas aún</p>
            </div>
          ) : (
            <div className="dashboard-top-productos">
              {topProductos.map((p, i) => (
                <div key={p.producto_id} className="dashboard-top-item">
                  <div className={"dashboard-top-rank rank-" + (i + 1)}>
                    {i + 1}
                  </div>
                  <div className="dashboard-top-info">
                    <div className="dashboard-top-nombre">{p.nombre}</div>
                    <div className="dashboard-top-codigo">{p.codigo}</div>
                  </div>
                  <div className="dashboard-top-stats">
                    <div className="dashboard-top-cantidad">
                      {p.cantidad_vendida} uds
                    </div>
                    <div className="dashboard-top-ingreso">
                      {formatoMoneda(p.ingreso_total)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ========== ACTIVIDAD RECIENTE ========== */}
      <div className="card-panel">
        <div className="dashboard-panel-header">
          <div>
            <h3>Actividad reciente</h3>
            <p>Últimas 5 ventas registradas</p>
          </div>
          <button
            className="btn-ver-todo"
            onClick={() => navigate("/ventas")}
          >
            Ver todo
            <ArrowRight size={14} />
          </button>
        </div>

        {cargando ? (
          <p className="texto-vacio">Cargando...</p>
        ) : actividad.length === 0 ? (
          <div className="dashboard-grafica-vacia">
            <Clock size={32} strokeWidth={1.2} />
            <p>No hay actividad registrada aún</p>
            <button
              className="btn-primario-chico"
              onClick={() => navigate("/pos")}
              style={{ marginTop: 12 }}
            >
              <ShoppingBag size={14} />
              Hacer primera venta
            </button>
          </div>
        ) : (
          <div className="dashboard-actividad">
            {actividad.map((a) => (
              <button
                key={a.id}
                className="dashboard-actividad-item"
                onClick={() => navigate(`/ventas/${a.id}`)}
              >
                <div className="dashboard-actividad-icono">
                  <Receipt size={16} />
                </div>
                <div className="dashboard-actividad-info">
                  <div className="dashboard-actividad-factura">{a.numero_factura}</div>
                  <div className="dashboard-actividad-meta">
                    {a.hace}
                  </div>
                </div>
                <div className="dashboard-actividad-metodo">
                  {iconoMetodo(a.metodo_pago)}
                  <span>{a.metodo_pago}</span>
                </div>
                <div className="dashboard-actividad-total">
                  {formatoMoneda(a.total)}
                </div>
                <ArrowRight size={16} className="dashboard-actividad-arrow" />
              </button>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}