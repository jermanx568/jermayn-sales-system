import { useState } from "react";
import {
  Search,
  X,
  Check,
  Receipt,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import Modal from "./Modal";
import { supabase } from "../lib/supabase";
import { useToast } from "../hooks/useToast";
import { useAuth } from "../contexts/AuthContext";
import type { ItemDevolucion } from "../types";

const MOTIVOS = [
  "Producto dañado",
  "Producto vencido",
  "Cliente arrepentido",
  "Error de cobro",
  "Producto equivocado",
  "Otro",
];

interface ModalDevolucionProps {
  abierto: boolean;
  onCerrar: () => void;
  onCreada: () => void;
}

interface VentaBuscada {
  id: string;
  numero_factura: string;
  cliente_nombre: string | null;
  total: number;
  fecha: string;
}

export default function ModalDevolucion({
  abierto,
  onCerrar,
  onCreada,
}: ModalDevolucionProps) {
  const toast = useToast();
  const { user } = useAuth();

  // Estado paso 1: buscar factura
  const [busquedaFactura, setBusquedaFactura] = useState("");
  const [resultados, setResultados] = useState<VentaBuscada[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [ventaSeleccionada, setVentaSeleccionada] = useState<VentaBuscada | null>(null);

  // Estado paso 2: seleccionar items
  const [items, setItems] = useState<ItemDevolucion[]>([]);
  const [cargandoItems, setCargandoItems] = useState(false);

  // Estado paso 3: motivo y reingreso
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [motivoCustom, setMotivoCustom] = useState("");
  const [reingresarStock, setReingresarStock] = useState(true);
  const [procesando, setProcesando] = useState(false);

  function resetear() {
    setBusquedaFactura("");
    setResultados([]);
    setVentaSeleccionada(null);
    setItems([]);
    setMotivo(MOTIVOS[0]);
    setMotivoCustom("");
    setReingresarStock(true);
    setProcesando(false);
  }

  async function buscarFacturas() {
    if (!busquedaFactura.trim()) return;
    setBuscando(true);

    const { data, error } = await supabase
      .from("ventas")
      .select("id, numero_factura, cliente_nombre, total, fecha")
      .ilike("numero_factura", `%${busquedaFactura.trim()}%`)
      .order("fecha", { ascending: false })
      .limit(10);

    if (error) {
      toast.error("Error al buscar: " + error.message);
    } else {
      setResultados(data || []);
      if ((data || []).length === 0) {
        toast.info("No se encontraron facturas con ese número");
      }
    }
    setBuscando(false);
  }

  async function seleccionarVenta(venta: VentaBuscada) {
    setVentaSeleccionada(venta);
    setCargandoItems(true);

    // 1. Cargar detalle de la venta
    const { data: detalles, error: errDetalles } = await supabase
      .from("detalle_ventas")
      .select(`
        id,
        producto_id,
        lote_id,
        cantidad,
        precio_unitario,
        productos:producto_id (codigo, nombre)
      `)
      .eq("venta_id", venta.id);

    if (errDetalles) {
      toast.error("Error al cargar items: " + errDetalles.message);
      setCargandoItems(false);
      return;
    }

    // 2. Cargar devoluciones previas de esta venta para saber cuanto ya se devolvio
    const { data: devolucionesPrev } = await supabase
      .from("devoluciones")
      .select("id")
      .eq("venta_id", venta.id);

    const devIds = (devolucionesPrev || []).map((d: any) => d.id);

    let yaDevueltos = new Map<string, number>();
    if (devIds.length > 0) {
      const { data: detalleDev } = await supabase
        .from("detalle_devoluciones")
        .select("producto_id, cantidad")
        .in("devolucion_id", devIds);

      (detalleDev || []).forEach((dd: any) => {
        const prev = yaDevueltos.get(dd.producto_id) || 0;
        yaDevueltos.set(dd.producto_id, prev + dd.cantidad);
      });
    }

    // 3. Agrupar por producto (puede haber varias lineas del mismo producto por FIFO)
    const itemsMap = new Map<string, ItemDevolucion>();

    (detalles || []).forEach((d: any) => {
      const key = d.producto_id;
      const yaDev = yaDevueltos.get(key) || 0;

      if (itemsMap.has(key)) {
        const existente = itemsMap.get(key)!;
        existente.cantidad_vendida += d.cantidad;
        existente.cantidad_disponible =
          existente.cantidad_vendida - yaDev;
      } else {
        itemsMap.set(key, {
          detalle_venta_id: d.id,
          producto_id: d.producto_id,
          lote_id: d.lote_id,
          producto_codigo: d.productos?.codigo ?? "—",
          producto_nombre: d.productos?.nombre ?? "—",
          cantidad_vendida: d.cantidad,
          cantidad_disponible: d.cantidad - yaDev,
          cantidad_a_devolver: 0,
          precio_unitario: Number(d.precio_unitario),
          seleccionado: false,
        });
      }
    });

    setItems(Array.from(itemsMap.values()));
    setCargandoItems(false);
  }

  function toggleItem(productoId: string) {
    setItems(
      items.map((i) =>
        i.producto_id === productoId
          ? {
              ...i,
              seleccionado: !i.seleccionado,
              cantidad_a_devolver: !i.seleccionado ? 1 : 0,
            }
          : i
      )
    );
  }

  function cambiarCantidadDevolver(productoId: string, cantidad: number) {
    setItems(
      items.map((i) => {
        if (i.producto_id !== productoId) return i;
        const cant = Math.max(0, Math.min(cantidad, i.cantidad_disponible));
        return {
          ...i,
          cantidad_a_devolver: cant,
          seleccionado: cant > 0,
        };
      })
    );
  }

  function calcularMonto() {
    return items
      .filter((i) => i.seleccionado && i.cantidad_a_devolver > 0)
      .reduce((acc, i) => acc + i.cantidad_a_devolver * i.precio_unitario, 0);
  }

  const itemsSeleccionados = items.filter(
    (i) => i.seleccionado && i.cantidad_a_devolver > 0
  );

  async function procesarDevolucion() {
    if (!ventaSeleccionada) return;
    if (itemsSeleccionados.length === 0) {
      toast.error("Selecciona al menos un producto para devolver");
      return;
    }

    const motivoFinal =
      motivo === "Otro" && motivoCustom.trim() ? motivoCustom.trim() : motivo;

    setProcesando(true);

    try {
      const monto = calcularMonto();

      // 1. Crear devolucion
      const { data: devData, error: devError } = await supabase
        .from("devoluciones")
        .insert({
          venta_id: ventaSeleccionada.id,
          motivo: motivoFinal,
          monto,
          usuario_id: user?.id,
        })
        .select()
        .single();

      if (devError || !devData) {
        throw new Error("Error al crear devolución: " + devError?.message);
      }

      // 2. Insertar detalles y reingresar stock si aplica
      for (const item of itemsSeleccionados) {
        // Necesito el lote_id real del detalle_ventas para reingresar al mismo lote
        const { data: detalleVenta } = await supabase
          .from("detalle_ventas")
          .select("lote_id")
          .eq("id", item.detalle_venta_id)
          .single();

        const loteId = detalleVenta?.lote_id ?? null;

        await supabase.from("detalle_devoluciones").insert({
          devolucion_id: devData.id,
          producto_id: item.producto_id,
          lote_id: loteId,
          cantidad: item.cantidad_a_devolver,
          precio_unitario: item.precio_unitario,
          subtotal: item.cantidad_a_devolver * item.precio_unitario,
          reingresado: reingresarStock,
        });

        // Reingresar stock al lote original
        if (reingresarStock && loteId) {
          const { error: stockError } = await supabase.rpc("reingresar_stock_lote", {
            p_lote_id: loteId,
            p_cantidad: item.cantidad_a_devolver,
          });

          if (stockError) {
            console.error("Error reingresando stock:", stockError);
          }
        }
      }

      toast.exito("Devolución registrada correctamente");
      resetear();
      onCreada();
    } catch (err: any) {
      toast.error(err.message || "Error al procesar devolución");
    } finally {
      setProcesando(false);
    }
  }

  function formatoMoneda(n: number) {
    return "$" + n.toFixed(2);
  }

  function formatoFecha(fecha: string) {
    return new Date(fecha).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function cerrar() {
    resetear();
    onCerrar();
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={cerrar}
      titulo={
        ventaSeleccionada
          ? `Devolución de ${ventaSeleccionada.numero_factura}`
          : "Nueva devolución"
      }
    >
      {/* ============ PASO 1: Buscar factura ============ */}
      {!ventaSeleccionada && (
        <div>
          <p className="dev-intro">
            Busca la factura original para comenzar la devolución.
          </p>

          <div className="dev-busqueda">
            <Search size={16} />
            <input
              type="text"
              placeholder="Ej: FAC-000001"
              value={busquedaFactura}
              onChange={(e) => setBusquedaFactura(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && buscarFacturas()}
              autoFocus
            />
            <button
              type="button"
              className="btn-primario-chico"
              onClick={buscarFacturas}
              disabled={buscando || !busquedaFactura.trim()}
            >
              {buscando ? "Buscando..." : "Buscar"}
            </button>
          </div>

          {resultados.length > 0 && (
            <div className="dev-resultados">
              <p className="dev-resultados-titulo">
                {resultados.length} factura{resultados.length !== 1 ? "s" : ""} encontrada
                {resultados.length !== 1 ? "s" : ""}:
              </p>
              {resultados.map((r) => (
                <button
                  key={r.id}
                  className="dev-resultado-item"
                  onClick={() => seleccionarVenta(r)}
                >
                  <div className="dev-resultado-icono">
                    <Receipt size={18} />
                  </div>
                  <div className="dev-resultado-info">
                    <div className="dev-resultado-factura">{r.numero_factura}</div>
                    <div className="dev-resultado-meta">
                      {formatoFecha(r.fecha)} • {r.cliente_nombre || "Consumidor final"}
                    </div>
                  </div>
                  <div className="dev-resultado-total">{formatoMoneda(r.total)}</div>
                </button>
              ))}
            </div>
          )}

          {!buscando && busquedaFactura && resultados.length === 0 && (
            <div className="dev-vacio">
              <AlertCircle size={20} />
              <span>No se encontraron facturas. Verifica el número.</span>
            </div>
          )}
        </div>
      )}

      {/* ============ PASO 2: Seleccionar items ============ */}
      {ventaSeleccionada && (
        <div>
          <button className="btn-volver" onClick={() => setVentaSeleccionada(null)}>
            <ArrowLeft size={14} />
            Buscar otra factura
          </button>

          <div className="dev-factura-info">
            <div>
              <span>Factura</span>
              <strong>{ventaSeleccionada.numero_factura}</strong>
            </div>
            <div>
              <span>Cliente</span>
              <strong>{ventaSeleccionada.cliente_nombre || "Consumidor final"}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{formatoMoneda(ventaSeleccionada.total)}</strong>
            </div>
          </div>

          {cargandoItems ? (
            <p className="texto-vacio">Cargando items...</p>
          ) : items.length === 0 ? (
            <p className="texto-vacio">Esta factura no tiene items.</p>
          ) : (
            <>
              <p className="dev-seccion-titulo">
                Selecciona los productos a devolver:
              </p>

              <div className="dev-items">
                {items.map((item) => {
                  const sinDisponible = item.cantidad_disponible <= 0;
                  return (
                    <div
                      key={item.producto_id}
                      className={
                        "dev-item" +
                        (item.seleccionado ? " dev-item-activo" : "") +
                        (sinDisponible ? " dev-item-agotado" : "")
                      }
                    >
                      <button
                        type="button"
                        className="dev-item-check"
                        onClick={() => !sinDisponible && toggleItem(item.producto_id)}
                        disabled={sinDisponible}
                      >
                        {item.seleccionado ? (
                          <CheckCircle size={20} />
                        ) : sinDisponible ? (
                          <XCircle size={20} />
                        ) : (
                          <div className="dev-item-check-vacio" />
                        )}
                      </button>

                      <div className="dev-item-info">
                        <div className="dev-item-nombre">{item.producto_nombre}</div>
                        <div className="dev-item-meta">
                          {item.producto_codigo} •{" "}
                          {formatoMoneda(item.precio_unitario)} c/u
                        </div>
                        <div className="dev-item-cantidades">
                          <span>
                            Vendidos: <strong>{item.cantidad_vendida}</strong>
                          </span>
                          {item.cantidad_disponible < item.cantidad_vendida && (
                            <span className="texto-muted">
                              (Disponibles: {item.cantidad_disponible})
                            </span>
                          )}
                        </div>
                      </div>

                      {item.seleccionado && !sinDisponible && (
                        <div className="dev-item-cantidad-control">
                          <input
                            type="number"
                            min="1"
                            max={item.cantidad_disponible}
                            value={item.cantidad_a_devolver}
                            onChange={(e) =>
                              cambiarCantidadDevolver(
                                item.producto_id,
                                parseInt(e.target.value) || 0
                              )
                            }
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="campo">
                <label>Motivo de la devolución *</label>
                <select
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="select-filtro"
                  style={{ width: "100%", padding: "11px 14px" }}
                >
                  {MOTIVOS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {motivo === "Otro" && (
                <div className="campo">
                  <label>Especifica el motivo</label>
                  <input
                    type="text"
                    value={motivoCustom}
                    onChange={(e) => setMotivoCustom(e.target.value)}
                    placeholder="Describe el motivo..."
                    autoFocus
                  />
                </div>
              )}

              <div className="campo">
                <label className="switch-label">
                  <input
                    type="checkbox"
                    checked={reingresarStock}
                    onChange={(e) => setReingresarStock(e.target.checked)}
                  />
                  <span className="switch"></span>
                  <span>Reingresar producto al stock del lote original</span>
                </label>
                <small className="texto-muted" style={{ fontSize: 11, marginLeft: 50 }}>
                  Si el producto está dañado o vencido, desactiva esta opción.
                </small>
              </div>

              {itemsSeleccionados.length > 0 && (
                <div className="dev-resumen">
                  <div className="dev-resumen-linea">
                    <span>Productos seleccionados</span>
                    <span>{itemsSeleccionados.length}</span>
                  </div>
                  <div className="dev-resumen-linea">
                    <span>Unidades totales</span>
                    <span>
                      {itemsSeleccionados.reduce(
                        (a, i) => a + i.cantidad_a_devolver,
                        0
                      )}
                    </span>
                  </div>
                  <div className="dev-resumen-linea dev-resumen-total">
                    <span>Monto a devolver</span>
                    <span>{formatoMoneda(calcularMonto())}</span>
                  </div>
                </div>
              )}

              <div className="modal-acciones">
                <button
                  type="button"
                  className="btn-secundario"
                  onClick={cerrar}
                  disabled={procesando}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primario-chico"
                  onClick={procesarDevolucion}
                  disabled={procesando || itemsSeleccionados.length === 0}
                >
                  {procesando ? "Procesando..." : "Confirmar devolución"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}