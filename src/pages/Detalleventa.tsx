import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Banknote,
  CreditCard,
  ArrowLeftRight,
  Package,
  Boxes,
  TrendingUp,
  CheckCircle,
} from "lucide-react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";
import { useToast } from "../hooks/useToast";
import type { DetalleVentaConTrazabilidad, VentaConDetalles } from "../types";

export default function DetalleVenta() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [venta, setVenta] = useState<VentaConDetalles | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (id) cargarVenta(id);
  }, [id]);

  async function cargarVenta(ventaId: string) {
    setCargando(true);

    // 1. Cargar venta
    const { data: ventaData, error: ventaError } = await supabase
      .from("ventas")
      .select("*")
      .eq("id", ventaId)
      .single();

    if (ventaError || !ventaData) {
      toast.error("No se encontró la venta");
      navigate("/ventas");
      return;
    }

    // 2. Cargar detalles con trazabilidad (producto + lote)
    const { data: detallesData, error: detallesError } = await supabase
      .from("detalle_ventas")
      .select(`
        *,
        productos:producto_id (codigo, nombre),
        lotes:lote_id (codigo_lote, fecha_entrada, fecha_vencimiento, precio_compra_unitario)
      `)
      .eq("venta_id", ventaId);

    if (detallesError) {
      toast.error("Error al cargar detalle: " + detallesError.message);
      setCargando(false);
      return;
    }

    const detalles: DetalleVentaConTrazabilidad[] = (detallesData || []).map(
      (d: any) => {
        const costoUnitario = Number(d.lotes?.precio_compra_unitario ?? 0);
        const precioUnitario = Number(d.precio_unitario);
        return {
          id: d.id,
          venta_id: d.venta_id,
          producto_id: d.producto_id,
          lote_id: d.lote_id,
          cantidad: d.cantidad,
          precio_unitario: precioUnitario,
          descuento_linea: Number(d.descuento_linea),
          subtotal: Number(d.subtotal),
          producto_codigo: d.productos?.codigo ?? "—",
          producto_nombre: d.productos?.nombre ?? "Producto eliminado",
          lote_codigo: d.lotes?.codigo_lote ?? null,
          lote_fecha_entrada: d.lotes?.fecha_entrada ?? null,
          lote_fecha_vencimiento: d.lotes?.fecha_vencimiento ?? null,
          costo_unitario_lote: costoUnitario,
          margen_unitario: precioUnitario - costoUnitario,
          margen_total: (precioUnitario - costoUnitario) * d.cantidad,
        };
      }
    );

    setVenta({
      ...ventaData,
      subtotal: Number(ventaData.subtotal),
      descuento: Number(ventaData.descuento),
      total: Number(ventaData.total),
      iva_porcentaje: Number(ventaData.iva_porcentaje),
      iva_monto: Number(ventaData.iva_monto),
      monto_recibido: Number(ventaData.monto_recibido),
      cambio: Number(ventaData.cambio),
      detalles,
    });

    setCargando(false);
  }

  function formatoMoneda(n: number) {
    return "$" + Number(n).toFixed(2);
  }

  function formatoFecha(fecha: string | null) {
    if (!fecha) return "—";
    const d = new Date(fecha.includes("T") ? fecha : fecha + "T00:00:00");
    return d.toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function formatoFechaHora(fecha: string) {
    return new Date(fecha).toLocaleString("es-VE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function iconoMetodo(metodo: string) {
    if (metodo === "efectivo") return <Banknote size={18} />;
    if (metodo === "tarjeta") return <CreditCard size={18} />;
    return <ArrowLeftRight size={18} />;
  }

  if (cargando) {
    return (
      <Layout>
        <p className="texto-vacio">Cargando detalle...</p>
      </Layout>
    );
  }

  if (!venta) {
    return (
      <Layout>
        <p className="texto-vacio">No se encontró la venta</p>
      </Layout>
    );
  }

  const totalMargen = venta.detalles.reduce((a, d) => a + d.margen_total, 0);

  return (
    <Layout>
      <div className="page-header">
        <div>
          <button
            className="btn-volver"
            onClick={() => navigate("/ventas")}
          >
            <ArrowLeft size={16} />
            Volver al historial
          </button>
          <h2>Factura {venta.numero_factura}</h2>
          <p>{formatoFechaHora(venta.fecha)}</p>
        </div>
        <div className="estado-badge">
          <CheckCircle size={16} />
          {venta.estado}
        </div>
      </div>

      {/* ============ TARJETAS DE INFO ============ */}
      <div className="grid-cards" style={{ marginBottom: 24 }}>
        <div className="card-stat">
          <div className="card-stat-label">Cliente</div>
          <div className="card-stat-valor" style={{ fontSize: 18 }}>
            <User size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />
            {venta.cliente_nombre || "Consumidor final"}
          </div>
        </div>

        <div className="card-stat">
          <div className="card-stat-label">Método de pago</div>
          <div className="card-stat-valor" style={{ fontSize: 18 }}>
            {iconoMetodo(venta.metodo_pago)}
            <span style={{ marginLeft: 8, textTransform: "capitalize" }}>
              {venta.metodo_pago}
            </span>
          </div>
        </div>

        <div className="card-stat">
          <div className="card-stat-label">Total facturado</div>
          <div className="card-stat-valor" style={{ color: "#2563eb" }}>
            {formatoMoneda(venta.total)}
          </div>
        </div>

        <div className="card-stat">
          <div className="card-stat-label">Margen de ganancia</div>
          <div
            className="card-stat-valor"
            style={{ color: totalMargen >= 0 ? "#16a34a" : "#dc2626" }}
          >
            {formatoMoneda(totalMargen)}
          </div>
          <div className="card-stat-info">
            <TrendingUp size={12} style={{ verticalAlign: "middle" }} /> Real
          </div>
        </div>
      </div>

      {/* ============ DETALLE CON TRAZABILIDAD ============ */}
      <div className="card-panel">
        <div className="detalle-header">
          <h3>Productos vendidos y trazabilidad FIFO</h3>
          <p>Origen exacto de cada producto (de qué lote salió)</p>
        </div>

        <table className="tabla detalle-venta-tabla">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>P. Unit.</th>
              <th>Subtotal</th>
              <th>Lote origen</th>
              <th>Costo lote</th>
              <th>Margen</th>
            </tr>
          </thead>
          <tbody>
            {venta.detalles.map((d) => (
              <tr key={d.id}>
                <td>
                  <div className="celda-con-icono">
                    <div className="celda-icono">
                      <Package size={16} />
                    </div>
                    <div>
                      <strong>{d.producto_nombre}</strong>
                      <div className="texto-muted" style={{ fontSize: 12 }}>
                        {d.producto_codigo}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <strong>{d.cantidad}</strong>
                </td>
                <td>{formatoMoneda(d.precio_unitario)}</td>
                <td>
                  <strong>{formatoMoneda(d.subtotal)}</strong>
                </td>
                <td>
                  {d.lote_codigo ? (
                    <div className="lote-info">
                      <span className="badge-codigo">
                        <Boxes size={12} style={{ verticalAlign: "middle" }} />{" "}
                        {d.lote_codigo}
                      </span>
                      <div className="lote-fechas">
                        <span>Entrada: {formatoFecha(d.lote_fecha_entrada)}</span>
                        {d.lote_fecha_vencimiento && (
                          <span>Vence: {formatoFecha(d.lote_fecha_vencimiento)}</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="texto-muted">Sin lote</span>
                  )}
                </td>
                <td className="texto-muted">{formatoMoneda(d.costo_unitario_lote)}</td>
                <td>
                  <span
                    className={
                      "badge-margen " +
                      (d.margen_total >= 0 ? "badge-margen-ok" : "badge-margen-mal")
                    }
                  >
                    {formatoMoneda(d.margen_total)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ============ TOTALES ============ */}
      <div className="venta-totales-panel">
        <div className="venta-totales-info">
          <div className="venta-total-linea">
            <span>Subtotal</span>
            <span>{formatoMoneda(venta.subtotal)}</span>
          </div>
          {venta.descuento > 0 && (
            <div className="venta-total-linea venta-total-descuento">
              <span>Descuento</span>
              <span>- {formatoMoneda(venta.descuento)}</span>
            </div>
          )}
          <div className="venta-total-linea">
            <span>IVA ({venta.iva_porcentaje}%)</span>
            <span>{formatoMoneda(venta.iva_monto)}</span>
          </div>
          <div className="venta-total-linea venta-total-final">
            <span>TOTAL</span>
            <span>{formatoMoneda(venta.total)}</span>
          </div>
          <div className="venta-total-linea">
            <span>Recibido</span>
            <span>{formatoMoneda(venta.monto_recibido)}</span>
          </div>
          <div className="venta-total-linea">
            <span>Cambio</span>
            <span>{formatoMoneda(venta.cambio)}</span>
          </div>
        </div>
      </div>
    </Layout>
  );
}