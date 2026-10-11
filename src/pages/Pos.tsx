import { useEffect, useState, useMemo } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CreditCard,
  Banknote,
  ArrowLeftRight,
  Check,
  X,
  Package,
} from "lucide-react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../hooks/useToast";
import type { ItemCarrito, MetodoPago, Ticket } from "../types";

const IVA_PORCENTAJE = 16;

interface ProductoConStock {
  id: string;
  codigo: string;
  nombre: string;
  precio_venta: number;
  categoria_nombre: string | null;
  categoria_color: string | null;
  stock_disponible: number;
}

export default function POS() {
  const toast = useToast();
  const { user } = useAuth();

  const [productos, setProductos] = useState<ProductoConStock[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [categorias, setCategorias] = useState<{ id: string; nombre: string }[]>([]);

  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [descuento, setDescuento] = useState(0);

  // Modal de cobro
  const [modalCobro, setModalCobro] = useState(false);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [montoRecibido, setMontoRecibido] = useState(0);
  const [clienteNombre, setClienteNombre] = useState("");
  const [procesando, setProcesando] = useState(false);

  // Ticket final
  const [ticket, setTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setCargando(true);

    const [prodRes, catRes, lotesRes] = await Promise.all([
      supabase
        .from("productos")
        .select(`
          id, codigo, nombre, precio_venta, categoria_id,
          categorias:categoria_id (nombre, color)
        `)
        .eq("activo", true)
        .order("nombre"),
      supabase.from("categorias").select("id, nombre").eq("activa", true).order("nombre"),
      supabase.from("lotes").select("producto_id, cantidad_actual").gt("cantidad_actual", 0),
    ]);

    if (prodRes.error) {
      toast.error("Error al cargar productos: " + prodRes.error.message);
    } else {
      // Calcular stock disponible por producto sumando lotes
      const stockPorProducto = new Map<string, number>();
      (lotesRes.data || []).forEach((l: any) => {
        stockPorProducto.set(
          l.producto_id,
          (stockPorProducto.get(l.producto_id) || 0) + l.cantidad_actual
        );
      });

      const productosConStock: ProductoConStock[] = (prodRes.data || []).map((p: any) => ({
        id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        precio_venta: Number(p.precio_venta),
        categoria_nombre: p.categorias?.nombre ?? null,
        categoria_color: p.categorias?.color ?? null,
        stock_disponible: stockPorProducto.get(p.id) || 0,
      }));

      setProductos(productosConStock);
    }

    if (!catRes.error) setCategorias(catRes.data || []);
    setCargando(false);
  }

  // ==================== FILTRADO ====================
  const productosFiltrados = useMemo(() => {
    let resultado = [...productos];
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      resultado = resultado.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          p.codigo.toLowerCase().includes(q)
      );
    }
    return resultado;
  }, [productos, busqueda]);

  const categoriasConProductos = useMemo(() => {
    const cats = new Set<string>();
    productos.forEach((p) => p.categoria_nombre && cats.add(p.categoria_nombre));
    return Array.from(cats);
  }, [productos]);

  const productosMostrados = useMemo(() => {
    if (filtroCategoria === "todas") return productosFiltrados;
    return productosFiltrados.filter((p) => p.categoria_nombre === filtroCategoria);
  }, [productosFiltrados, filtroCategoria]);

  // ==================== CARRITO ====================
  function agregarAlCarrito(prod: ProductoConStock) {
    if (prod.stock_disponible <= 0) {
      toast.error("Sin stock disponible para " + prod.nombre);
      return;
    }

    const existente = carrito.find((i) => i.producto_id === prod.id);
    if (existente) {
      if (existente.cantidad >= prod.stock_disponible) {
        toast.error(`Solo hay ${prod.stock_disponible} unidades disponibles`);
        return;
      }
      setCarrito(
        carrito.map((i) =>
          i.producto_id === prod.id ? { ...i, cantidad: i.cantidad + 1 } : i
        )
      );
    } else {
      setCarrito([
        ...carrito,
        {
          producto_id: prod.id,
          codigo: prod.codigo,
          nombre: prod.nombre,
          precio_unitario: prod.precio_venta,
          cantidad: 1,
          stock_disponible: prod.stock_disponible,
        },
      ]);
    }
  }

  function cambiarCantidad(productoId: string, delta: number) {
    setCarrito(
      carrito
        .map((i) => {
          if (i.producto_id !== productoId) return i;
          const nueva = i.cantidad + delta;
          if (nueva < 1) return i;
          if (nueva > i.stock_disponible) {
            toast.error(`Solo hay ${i.stock_disponible} unidades`);
            return i;
          }
          return { ...i, cantidad: nueva };
        })
        .filter((i) => i.cantidad > 0)
    );
  }

  function eliminarDelCarrito(productoId: string) {
    setCarrito(carrito.filter((i) => i.producto_id !== productoId));
  }

  function vaciarCarrito() {
    if (carrito.length === 0) return;
    if (confirm("¿Vaciar el carrito?")) {
      setCarrito([]);
      setDescuento(0);
    }
  }

  // ==================== TOTALES ====================
  const subtotal = carrito.reduce((acc, i) => acc + i.precio_unitario * i.cantidad, 0);
  const baseImponible = Math.max(0, subtotal - descuento);
  const ivaMonto = baseImponible * (IVA_PORCENTAJE / 100);
  const total = baseImponible + ivaMonto;

  // ==================== PROCESAR VENTA ====================
  async function procesarVenta() {
    if (carrito.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }

    if (metodoPago === "efectivo" && montoRecibido < total) {
      toast.error("El monto recibido es menor al total");
      return;
    }

    setProcesando(true);

    try {
      // 1. Generar numero de factura
      const { data: numData, error: numError } = await supabase.rpc("generar_numero_factura");
      if (numError || !numData) throw new Error("Error al generar número de factura");
      const numeroFactura = numData as unknown as string;

      // 2. Insertar venta
      const { data: ventaData, error: ventaError } = await supabase
        .from("ventas")
        .insert({
          numero_factura: numeroFactura,
          usuario_id: user?.id,
          cliente_nombre: clienteNombre.trim() || null,
          subtotal,
          descuento,
          total,
          iva_porcentaje: IVA_PORCENTAJE,
          iva_monto: ivaMonto,
          metodo_pago: metodoPago,
          monto_recibido: metodoPago === "efectivo" ? montoRecibido : total,
          cambio: metodoPago === "efectivo" ? montoRecibido - total : 0,
          estado: "completada",
        })
        .select()
        .single();

      if (ventaError || !ventaData) throw new Error("Error al crear venta: " + ventaError?.message);

      // 3. Descontar stock por FIFO e insertar detalle
      for (const item of carrito) {
        // Llamar función FIFO de Postgres
        const { data: descuentos, error: fifoError } = await supabase.rpc("descontar_stock_fifo", {
          p_producto_id: item.producto_id,
          p_cantidad: item.cantidad,
        });

        if (fifoError) {
          throw new Error(
            `Error descontando stock de ${item.nombre}: ${fifoError.message}`
          );
        }

        // Insertar una línea de detalle por cada lote descontado
        const descuentosArr = (descuentos || []) as any[];
        for (const d of descuentosArr) {
          await supabase.from("detalle_ventas").insert({
            venta_id: ventaData.id,
            producto_id: item.producto_id,
            lote_id: d.lote_id,
            cantidad: d.cantidad_descontada,
            precio_unitario: item.precio_unitario,
            descuento_linea: 0,
            subtotal: item.precio_unitario * d.cantidad_descontada,
          });
        }
      }

      // 4. Guardar ticket y mostrar modal
      const nuevoTicket: Ticket = {
        numero_factura: numeroFactura,
        cliente_nombre: clienteNombre.trim() || "Consumidor final",
        items: [...carrito],
        subtotal,
        descuento,
        iva_porcentaje: IVA_PORCENTAJE,
        iva_monto: ivaMonto,
        total,
        metodo_pago: metodoPago,
        monto_recibido: metodoPago === "efectivo" ? montoRecibido : total,
        cambio: metodoPago === "efectivo" ? montoRecibido - total : 0,
        fecha: new Date().toISOString(),
      };

      setTicket(nuevoTicket);
      setModalCobro(false);
      toast.exito("¡Venta registrada correctamente!");

      // Resetear
      setCarrito([]);
      setDescuento(0);
      setMontoRecibido(0);
      setClienteNombre("");
      setMetodoPago("efectivo");

      // Recargar stock
      cargarDatos();
    } catch (err: any) {
      toast.error(err.message || "Error al procesar la venta");
    } finally {
      setProcesando(false);
    }
  }

  function formatoMoneda(n: number) {
    return "$" + n.toFixed(2);
  }

  // ==================== RENDER ====================
  return (
    <Layout>
      <div className="pos-container">
        {/* ============ COLUMNA IZQUIERDA: PRODUCTOS ============ */}
        <div className="pos-productos">
          <div className="pos-header">
            <h2>Punto de Venta</h2>
            <p>Toca un producto para agregarlo al carrito</p>
          </div>

          <div className="pos-busqueda">
            <Search size={18} />
            <input
              type="text"
              placeholder="Buscar producto por nombre o código..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              autoFocus
            />
          </div>

          <div className="pos-categorias">
            <button
              className={"pos-cat-btn" + (filtroCategoria === "todas" ? " activo" : "")}
              onClick={() => setFiltroCategoria("todas")}
            >
              Todas
            </button>
            {categoriasConProductos.map((cat) => (
              <button
                key={cat}
                className={"pos-cat-btn" + (filtroCategoria === cat ? " activo" : "")}
                onClick={() => setFiltroCategoria(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {cargando ? (
            <p className="texto-vacio">Cargando productos...</p>
          ) : productosMostrados.length === 0 ? (
            <p className="texto-vacio">No se encontraron productos</p>
          ) : (
            <div className="pos-grid">
              {productosMostrados.map((prod) => {
                const enCarrito = carrito.find((i) => i.producto_id === prod.id);
                const sinStock = prod.stock_disponible <= 0;
                return (
                  <button
                    key={prod.id}
                    className={
                      "pos-card" +
                      (sinStock ? " pos-card-sinstock" : "") +
                      (enCarrito ? " pos-card-activo" : "")
                    }
                    onClick={() => !sinStock && agregarAlCarrito(prod)}
                    disabled={sinStock}
                  >
                    <div className="pos-card-icono">
                      <Package size={20} />
                    </div>
                    <div className="pos-card-nombre">{prod.nombre}</div>
                    <div className="pos-card-codigo">{prod.codigo}</div>
                    {prod.categoria_nombre && (
                      <div
                        className="pos-card-categoria"
                        style={{
                          backgroundColor: (prod.categoria_color || "#2563eb") + "20",
                          color: prod.categoria_color || "#2563eb",
                        }}
                      >
                        {prod.categoria_nombre}
                      </div>
                    )}
                    <div className="pos-card-footer">
                      <span className="pos-card-precio">
                        {formatoMoneda(prod.precio_venta)}
                      </span>
                      <span
                        className={
                          "pos-card-stock" + (sinStock ? " pos-card-stock-agotado" : "")
                        }
                      >
                        {sinStock ? "Agotado" : `${prod.stock_disponible} disp.`}
                      </span>
                    </div>
                    {enCarrito && (
                      <div className="pos-card-badge">{enCarrito.cantidad}</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ============ COLUMNA DERECHA: CARRITO ============ */}
        <div className="pos-carrito">
          <div className="pos-carrito-header">
            <div className="pos-carrito-titulo">
              <ShoppingCart size={20} />
              <span>Carrito</span>
              {carrito.length > 0 && (
                <span className="pos-carrito-count">
                  {carrito.reduce((a, i) => a + i.cantidad, 0)}
                </span>
              )}
            </div>
            {carrito.length > 0 && (
              <button className="pos-vaciar" onClick={vaciarCarrito} title="Vaciar">
                <Trash2 size={16} />
              </button>
            )}
          </div>

          <div className="pos-carrito-items">
            {carrito.length === 0 ? (
              <div className="pos-carrito-vacio">
                <ShoppingCart size={48} strokeWidth={1.2} />
                <p>El carrito está vacío</p>
                <span>Toca un producto para comenzar</span>
              </div>
            ) : (
              carrito.map((item) => (
                <div key={item.producto_id} className="pos-item">
                  <div className="pos-item-info">
                    <div className="pos-item-nombre">{item.nombre}</div>
                    <div className="pos-item-precio">
                      {formatoMoneda(item.precio_unitario)} × {item.cantidad} ={" "}
                      <strong>{formatoMoneda(item.precio_unitario * item.cantidad)}</strong>
                    </div>
                  </div>
                  <div className="pos-item-controles">
                    <button
                      className="pos-btn-cantidad"
                      onClick={() => cambiarCantidad(item.producto_id, -1)}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="pos-item-cantidad">{item.cantidad}</span>
                    <button
                      className="pos-btn-cantidad"
                      onClick={() => cambiarCantidad(item.producto_id, 1)}
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      className="pos-btn-eliminar"
                      onClick={() => eliminarDelCarrito(item.producto_id)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {carrito.length > 0 && (
            <div className="pos-carrito-footer">
              <div className="pos-descuento">
                <label>Descuento ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={subtotal}
                  value={descuento || ""}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    setDescuento(Math.min(Math.max(0, v), subtotal));
                  }}
                  placeholder="0.00"
                />
              </div>

              <div className="pos-totales">
                <div className="pos-total-linea">
                  <span>Subtotal</span>
                  <span>{formatoMoneda(subtotal)}</span>
                </div>
                {descuento > 0 && (
                  <div className="pos-total-linea pos-total-descuento">
                    <span>Descuento</span>
                    <span>- {formatoMoneda(descuento)}</span>
                  </div>
                )}
                <div className="pos-total-linea">
                  <span>IVA ({IVA_PORCENTAJE}%)</span>
                  <span>{formatoMoneda(ivaMonto)}</span>
                </div>
                <div className="pos-total-linea pos-total-final">
                  <span>TOTAL</span>
                  <span>{formatoMoneda(total)}</span>
                </div>
              </div>

              <button
                className="pos-btn-cobrar"
                onClick={() => {
                  setMontoRecibido(total);
                  setModalCobro(true);
                }}
              >
                <Check size={20} />
                Cobrar {formatoMoneda(total)}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ============ MODAL DE COBRO ============ */}
      {modalCobro && (
        <div className="modal-overlay" onClick={() => !procesando && setModalCobro(false)}>
          <div className="modal-content modal-cobro" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Cobrar venta</h2>
              <button
                className="modal-cerrar"
                onClick={() => setModalCobro(false)}
                disabled={procesando}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="cobro-total-destacado">
                <span>Total a cobrar</span>
                <strong>{formatoMoneda(total)}</strong>
              </div>

              <div className="campo">
                <label>Cliente (opcional)</label>
                <input
                  type="text"
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  placeholder="Consumidor final"
                />
              </div>

              <div className="campo">
                <label>Método de pago</label>
                <div className="metodos-pago">
                  <button
                    type="button"
                    className={"metodo-btn" + (metodoPago === "efectivo" ? " activo" : "")}
                    onClick={() => setMetodoPago("efectivo")}
                  >
                    <Banknote size={20} />
                    Efectivo
                  </button>
                  <button
                    type="button"
                    className={"metodo-btn" + (metodoPago === "tarjeta" ? " activo" : "")}
                    onClick={() => setMetodoPago("tarjeta")}
                  >
                    <CreditCard size={20} />
                    Tarjeta
                  </button>
                  <button
                    type="button"
                    className={
                      "metodo-btn" + (metodoPago === "transferencia" ? " activo" : "")
                    }
                    onClick={() => setMetodoPago("transferencia")}
                  >
                    <ArrowLeftRight size={20} />
                    Transferencia
                  </button>
                </div>
              </div>

              {metodoPago === "efectivo" && (
                <>
                  <div className="campo">
                    <label>Monto recibido</label>
                    <input
                      type="number"
                      step="0.01"
                      min={total}
                      value={montoRecibido}
                      onChange={(e) => setMontoRecibido(parseFloat(e.target.value) || 0)}
                      autoFocus
                    />
                  </div>

                  <div className="cobro-cambio">
                    <span>Cambio</span>
                    <strong
                      className={montoRecibido < total ? "cobro-cambio-falta" : ""}
                    >
                      {formatoMoneda(Math.max(0, montoRecibido - total))}
                    </strong>
                  </div>

                  <div className="billetes-rapidos">
                    {[1, 2, 5, 10, 20, 50, 100].map((b) => (
                      <button
                        key={b}
                        type="button"
                        className="billete-btn"
                        onClick={() => setMontoRecibido(b)}
                      >
                        ${b}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="billete-btn billete-exacto"
                      onClick={() => setMontoRecibido(total)}
                    >
                      Exacto
                    </button>
                  </div>
                </>
              )}

              <div className="modal-acciones">
                <button
                  type="button"
                  className="btn-secundario"
                  onClick={() => setModalCobro(false)}
                  disabled={procesando}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primario-chico"
                  onClick={procesarVenta}
                  disabled={procesando || (metodoPago === "efectivo" && montoRecibido < total)}
                >
                  {procesando ? "Procesando..." : "Confirmar venta"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ MODAL DEL TICKET ============ */}
      {ticket && (
        <div className="modal-overlay" onClick={() => setTicket(null)}>
          <div className="modal-content modal-ticket" onClick={(e) => e.stopPropagation()}>
            <div className="ticket-exito">
              <div className="ticket-check">
                <Check size={32} strokeWidth={3} />
              </div>
              <h2>¡Venta completada!</h2>
              <p>Factura {ticket.numero_factura}</p>
            </div>

            <div className="ticket-body">
              <div className="ticket-header-info">
                <div className="ticket-marca">Jermayn Sales System</div>
                <div className="ticket-sub">Sistema POS</div>
              </div>

              <div className="ticket-linea-separadora"></div>

              <div className="ticket-info">
                <div>
                  <span>Factura:</span>
                  <strong>{ticket.numero_factura}</strong>
                </div>
                <div>
                  <span>Fecha:</span>
                  <strong>
                    {new Date(ticket.fecha).toLocaleString("es-VE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </strong>
                </div>
                <div>
                  <span>Cliente:</span>
                  <strong>{ticket.cliente_nombre}</strong>
                </div>
              </div>

              <div className="ticket-linea-separadora"></div>

              <div className="ticket-items">
                {ticket.items.map((item) => (
                  <div key={item.producto_id} className="ticket-item">
                    <div className="ticket-item-info">
                      <span>{item.nombre}</span>
                      <span className="texto-muted">
                        {item.cantidad} × {formatoMoneda(item.precio_unitario)}
                      </span>
                    </div>
                    <span className="ticket-item-total">
                      {formatoMoneda(item.precio_unitario * item.cantidad)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="ticket-linea-separadora"></div>

              <div className="ticket-totales">
                <div className="ticket-total-linea">
                  <span>Subtotal:</span>
                  <span>{formatoMoneda(ticket.subtotal)}</span>
                </div>
                {ticket.descuento > 0 && (
                  <div className="ticket-total-linea">
                    <span>Descuento:</span>
                    <span>- {formatoMoneda(ticket.descuento)}</span>
                  </div>
                )}
                <div className="ticket-total-linea">
                  <span>IVA ({ticket.iva_porcentaje}%):</span>
                  <span>{formatoMoneda(ticket.iva_monto)}</span>
                </div>
                <div className="ticket-total-linea ticket-total-final">
                  <span>TOTAL:</span>
                  <span>{formatoMoneda(ticket.total)}</span>
                </div>
                <div className="ticket-total-linea">
                  <span>Pago ({ticket.metodo_pago}):</span>
                  <span>{formatoMoneda(ticket.monto_recibido)}</span>
                </div>
                {ticket.metodo_pago === "efectivo" && ticket.cambio > 0 && (
                  <div className="ticket-total-linea">
                    <span>Cambio:</span>
                    <span>{formatoMoneda(ticket.cambio)}</span>
                  </div>
                )}
              </div>

              <div className="ticket-linea-separadora"></div>

              <p className="ticket-gracias">¡Gracias por su compra!</p>
            </div>

            <div className="modal-acciones">
              <button
                type="button"
                className="btn-primario-chico"
                onClick={() => setTicket(null)}
                style={{ width: "100%" }}
              >
                Nueva venta
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}