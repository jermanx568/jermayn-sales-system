import { useEffect, useState, useMemo } from "react";
import type { FormEvent } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Boxes,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CalendarClock,
} from "lucide-react";
import Layout from "../components/Layout";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import { supabase } from "../lib/supabase";
import { useToast } from "../hooks/useToast";
import type { LoteConDetalles, Producto } from "../types";

type OrdenCampo = "fecha_entrada" | "fecha_vencimiento" | "cantidad_actual";
type OrdenDir = "asc" | "desc";
type FiltroVencimiento = "todos" | "vencidos" | "criticos" | "proximos" | "ok";

const POR_PAGINA = 10;

// Calcular estado de vencimiento
function calcularEstadoVencimiento(
  fechaVencimiento: string | null
): { dias: number | null; estado: LoteConDetalles["estado_vencimiento"] } {
  if (!fechaVencimiento) {
    return { dias: null, estado: "sin-vencimiento" };
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vence = new Date(fechaVencimiento + "T00:00:00");
  const diffMs = vence.getTime() - hoy.getTime();
  const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let estado: LoteConDetalles["estado_vencimiento"];
  if (dias < 0) estado = "vencido";
  else if (dias <= 7) estado = "critico";
  else if (dias <= 30) estado = "proximo";
  else estado = "ok";

  return { dias, estado };
}

export default function Lotes() {
  const toast = useToast();

  const [lotes, setLotes] = useState<LoteConDetalles[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroProducto, setFiltroProducto] = useState<string>("todos");
  const [filtroVencimiento, setFiltroVencimiento] = useState<FiltroVencimiento>("todos");
  const [ordenCampo, setOrdenCampo] = useState<OrdenCampo>("fecha_entrada");
  const [ordenDir, setOrdenDir] = useState<OrdenDir>("asc");
  const [pagina, setPagina] = useState(1);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<LoteConDetalles | null>(null);

  // Formulario
  const [productoId, setProductoId] = useState("");
  const [codigoLote, setCodigoLote] = useState("");
  const [cantidad, setCantidad] = useState(0);
  const [fechaEntrada, setFechaEntrada] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [precioCompra, setPrecioCompra] = useState(0);
  const [guardando, setGuardando] = useState(false);

  // Confirmar eliminación
  const [porEliminar, setPorEliminar] = useState<LoteConDetalles | null>(null);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    cargarTodo();
  }, []);

  async function cargarTodo() {
    setCargando(true);

    const [lotesRes, productosRes] = await Promise.all([
      supabase
        .from("lotes")
        .select(`
          *,
          productos:producto_id (
            nombre,
            codigo
          )
        `)
        .order("fecha_entrada", { ascending: true }),
      supabase
        .from("productos")
        .select("*")
        .eq("activo", true)
        .order("nombre"),
    ]);

    if (lotesRes.error) {
      toast.error("Error al cargar lotes: " + lotesRes.error.message);
    } else {
      const lotesConDetalles: LoteConDetalles[] = (lotesRes.data || []).map(
        (l: any) => {
          const { dias, estado } = calcularEstadoVencimiento(l.fecha_vencimiento);
          return {
            ...l,
            producto_nombre: l.productos?.nombre ?? "Producto eliminado",
            producto_codigo: l.productos?.codigo ?? "—",
            dias_para_vencer: dias,
            estado_vencimiento: estado,
          };
        }
      );
      setLotes(lotesConDetalles);
    }

    if (!productosRes.error) {
      setProductos(productosRes.data || []);
    }

    setCargando(false);
  }

  // ==================== FILTRADO, ORDEN Y PAGINACIÓN ====================
  const lotesFiltrados = useMemo(() => {
    let resultado = [...lotes];

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      resultado = resultado.filter(
        (l) =>
          (l.producto_nombre || "").toLowerCase().includes(q) ||
          (l.producto_codigo || "").toLowerCase().includes(q) ||
          (l.codigo_lote || "").toLowerCase().includes(q)
      );
    }

    if (filtroProducto !== "todos") {
      resultado = resultado.filter((l) => l.producto_id === filtroProducto);
    }

    if (filtroVencimiento !== "todos") {
      resultado = resultado.filter((l) => l.estado_vencimiento === filtroVencimiento);
    }

    resultado.sort((a, b) => {
      const av = (a[ordenCampo] ?? "") as any;
      const bv = (b[ordenCampo] ?? "") as any;
      if (av < bv) return ordenDir === "asc" ? -1 : 1;
      if (av > bv) return ordenDir === "asc" ? 1 : -1;
      return 0;
    });

    return resultado;
  }, [lotes, busqueda, filtroProducto, filtroVencimiento, ordenCampo, ordenDir]);

  const totalPaginas = Math.max(1, Math.ceil(lotesFiltrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const lotesPagina = lotesFiltrados.slice(
    (paginaActual - 1) * POR_PAGINA,
    paginaActual * POR_PAGINA
  );

  // ==================== ACCIONES ====================
  function cambiarOrden(campo: OrdenCampo) {
    if (ordenCampo === campo) {
      setOrdenDir(ordenDir === "asc" ? "desc" : "asc");
    } else {
      setOrdenCampo(campo);
      setOrdenDir("asc");
    }
  }

  function iconoOrden(campo: OrdenCampo) {
    if (ordenCampo !== campo) return <ArrowUpDown size={14} />;
    return ordenDir === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  }

  function abrirCrear() {
    setEditando(null);
    setProductoId("");
    setCodigoLote("");
    setCantidad(0);
    setFechaEntrada(new Date().toISOString().split("T")[0]);
    setFechaVencimiento("");
    setPrecioCompra(0);
    setModalAbierto(true);
  }

  function abrirEditar(lote: LoteConDetalles) {
    setEditando(lote);
    setProductoId(lote.producto_id);
    setCodigoLote(lote.codigo_lote || "");
    setCantidad(lote.cantidad_actual);
    setFechaEntrada(lote.fecha_entrada);
    setFechaVencimiento(lote.fecha_vencimiento || "");
    setPrecioCompra(lote.precio_compra_unitario);
    setModalAbierto(true);
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!productoId || cantidad <= 0) {
      toast.error("Selecciona un producto y cantidad mayor a 0");
      return;
    }

    setGuardando(true);

    if (editando) {
      // Actualizar lote
      const cantidadVendida = editando.cantidad_inicial - editando.cantidad_actual;
      if (cantidad < cantidadVendida) {
        toast.error(
          `La cantidad no puede ser menor a ${cantidadVendida} (ya se vendieron ${cantidadVendida} unidades)`
        );
        setGuardando(false);
        return;
      }

      const payload = {
        producto_id: productoId,
        codigo_lote: codigoLote.trim() || null,
        cantidad_inicial: cantidad,
        cantidad_actual: cantidad,
        fecha_entrada: fechaEntrada,
        fecha_vencimiento: fechaVencimiento || null,
        precio_compra_unitario: precioCompra,
      };

      const { error } = await supabase
        .from("lotes")
        .update(payload)
        .eq("id", editando.id);

      if (error) {
        toast.error("Error al actualizar: " + error.message);
      } else {
        toast.exito("Lote actualizado correctamente");
        setModalAbierto(false);
        cargarTodo();
      }
    } else {
      // Crear lote nuevo
      const payload = {
        producto_id: productoId,
        codigo_lote: codigoLote.trim() || null,
        cantidad_inicial: cantidad,
        cantidad_actual: cantidad,
        fecha_entrada: fechaEntrada,
        fecha_vencimiento: fechaVencimiento || null,
        precio_compra_unitario: precioCompra,
      };

      const { error } = await supabase.from("lotes").insert(payload);

      if (error) {
        toast.error("Error al crear: " + error.message);
      } else {
        toast.exito("Lote creado correctamente");
        setModalAbierto(false);
        cargarTodo();
      }
    }

    setGuardando(false);
  }

  async function confirmarEliminar() {
    if (!porEliminar) return;

    // Si ya se vendió algo del lote, no permitir eliminar
    if (porEliminar.cantidad_actual < porEliminar.cantidad_inicial) {
      toast.error(
        "No se puede eliminar un lote del que ya se han vendido unidades"
      );
      setPorEliminar(null);
      return;
    }

    setEliminando(true);
    const { error } = await supabase.from("lotes").delete().eq("id", porEliminar.id);
    setEliminando(false);

    if (error) {
      toast.error("Error al eliminar: " + error.message);
    } else {
      toast.exito("Lote eliminado");
      setPorEliminar(null);
      cargarTodo();
    }
  }

  function formatoMoneda(n: number) {
    return "$" + n.toFixed(2);
  }

  function formatoFecha(fecha: string | null) {
    if (!fecha) return "—";
    const d = new Date(fecha + "T00:00:00");
    return d.toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function etiquetaVencimiento(lote: LoteConDetalles) {
    if (lote.estado_vencimiento === "sin-vencimiento") {
      return <span className="texto-muted">Sin vencimiento</span>;
    }

    const clases: Record<string, string> = {
      vencido: "badge-vencido",
      critico: "badge-critico",
      proximo: "badge-proximo",
      ok: "badge-ok",
    };

    const textos: Record<string, string> = {
      vencido: `Vencido (${Math.abs(lote.dias_para_vencer || 0)}d)`,
      critico: `Vence en ${lote.dias_para_vencer}d`,
      proximo: `${lote.dias_para_vencer}d`,
      ok: `${lote.dias_para_vencer}d`,
    };

    return (
      <span className={"badge-vencimiento " + clases[lote.estado_vencimiento!]}>
        {lote.estado_vencimiento === "vencido" && <AlertTriangle size={12} />}
        {lote.estado_vencimiento === "critico" && <CalendarClock size={12} />}
        {textos[lote.estado_vencimiento!]}
      </span>
    );
  }

  // ==================== RENDER ====================
  return (
    <Layout>
      <div className="page-header">
        <div>
          <h2>Lotes y Vencimientos</h2>
          <p>Controla el inventario por lotes con sistema FIFO</p>
        </div>
        <button className="btn-primario-chico" onClick={abrirCrear}>
          <Plus size={18} />
          Nuevo lote
        </button>
      </div>

      <div className="card-panel">
        <div className="tabla-toolbar">
          <div className="tabla-busqueda">
            <Search size={16} />
            <input
              type="text"
              placeholder="Buscar por producto o lote..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPagina(1);
              }}
            />
          </div>

          <select
            className="select-filtro"
            value={filtroProducto}
            onChange={(e) => {
              setFiltroProducto(e.target.value);
              setPagina(1);
            }}
          >
            <option value="todos">Todos los productos</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>

          <select
            className="select-filtro"
            value={filtroVencimiento}
            onChange={(e) => {
              setFiltroVencimiento(e.target.value as any);
              setPagina(1);
            }}
          >
            <option value="todos">Todos los vencimientos</option>
            <option value="vencidos">🔴 Vencidos</option>
            <option value="criticos">🟠 Vencen en 7 días</option>
            <option value="proximos">🟡 Vencen en 30 días</option>
            <option value="ok">🟢 OK</option>
          </select>
        </div>

        {cargando ? (
          <p className="texto-vacio">Cargando...</p>
        ) : lotesFiltrados.length === 0 ? (
          <p className="texto-vacio">
            {busqueda || filtroProducto !== "todos" || filtroVencimiento !== "todos"
              ? "No se encontraron lotes con esos filtros"
              : "No hay lotes aún. Crea el primero."}
          </p>
        ) : (
          <>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Lote</th>
                  <th className="th-ordenable" onClick={() => cambiarOrden("cantidad_actual")}>
                    <span className="th-contenido">
                      Cantidad {iconoOrden("cantidad_actual")}
                    </span>
                  </th>
                  <th className="th-ordenable" onClick={() => cambiarOrden("fecha_entrada")}>
                    <span className="th-contenido">
                      Ingreso {iconoOrden("fecha_entrada")}
                    </span>
                  </th>
                  <th className="th-ordenable" onClick={() => cambiarOrden("fecha_vencimiento")}>
                    <span className="th-contenido">
                      Vence {iconoOrden("fecha_vencimiento")}
                    </span>
                  </th>
                  <th>P. Compra</th>
                  <th style={{ width: "120px" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lotesPagina.map((lote) => (
                  <tr key={lote.id}>
                    <td>
                      <div className="celda-con-icono">
                        <div className="celda-icono">
                          <Boxes size={16} />
                        </div>
                        <div>
                          <strong>{lote.producto_nombre}</strong>
                          <div className="texto-muted" style={{ fontSize: 12 }}>
                            {lote.producto_codigo}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {lote.codigo_lote ? (
                        <span className="badge-codigo">{lote.codigo_lote}</span>
                      ) : (
                        <span className="texto-muted">—</span>
                      )}
                    </td>
                    <td>
                      <div className="cantidad-lote">
                        <strong>{lote.cantidad_actual}</strong>
                        <span className="texto-muted"> / {lote.cantidad_inicial}</span>
                      </div>
                    </td>
                    <td>{formatoFecha(lote.fecha_entrada)}</td>
                    <td>
                      <div className="vencimiento-cell">
                        <span>{formatoFecha(lote.fecha_vencimiento)}</span>
                        {etiquetaVencimiento(lote)}
                      </div>
                    </td>
                    <td>{formatoMoneda(lote.precio_compra_unitario)}</td>
                    <td>
                      <div className="acciones-tabla">
                        <button
                          className="btn-icono"
                          onClick={() => abrirEditar(lote)}
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="btn-icono btn-icono-peligro"
                          onClick={() => setPorEliminar(lote)}
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPaginas > 1 && (
              <div className="paginacion">
                <span className="paginacion-info">
                  Mostrando {(paginaActual - 1) * POR_PAGINA + 1}–
                  {Math.min(paginaActual * POR_PAGINA, lotesFiltrados.length)} de{" "}
                  {lotesFiltrados.length}
                </span>
                <div className="paginacion-botones">
                  <button
                    className="btn-pagina"
                    onClick={() => setPagina(paginaActual - 1)}
                    disabled={paginaActual === 1}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="paginacion-pagina">
                    {paginaActual} / {totalPaginas}
                  </span>
                  <button
                    className="btn-pagina"
                    onClick={() => setPagina(paginaActual + 1)}
                    disabled={paginaActual === totalPaginas}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Crear/Editar */}
      <Modal
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        titulo={editando ? "Editar lote" : "Nuevo lote"}
      >
        <form onSubmit={guardar}>
          <div className="campo">
            <label>Producto *</label>
            <select
              value={productoId}
              onChange={(e) => setProductoId(e.target.value)}
              className="select-filtro"
              style={{ width: "100%", padding: "11px 14px" }}
              required
              disabled={!!editando}
            >
              <option value="">Seleccionar producto...</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.codigo} — {p.nombre}
                </option>
              ))}
            </select>
            {editando && (
              <small className="texto-muted" style={{ fontSize: 11 }}>
                No puedes cambiar el producto de un lote existente
              </small>
            )}
          </div>

          <div className="form-grid-2">
            <div className="campo">
              <label>Código de lote</label>
              <input
                type="text"
                value={codigoLote}
                onChange={(e) => setCodigoLote(e.target.value.toUpperCase())}
                placeholder="Ej: L-001"
                maxLength={20}
              />
            </div>

            <div className="campo">
              <label>Cantidad *</label>
              <input
                type="number"
                min="1"
                value={cantidad}
                onChange={(e) => setCantidad(parseInt(e.target.value) || 0)}
                required
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="campo">
              <label>Fecha de entrada *</label>
              <input
                type="date"
                value={fechaEntrada}
                onChange={(e) => setFechaEntrada(e.target.value)}
                required
              />
            </div>

            <div className="campo">
              <label>Fecha de vencimiento</label>
              <input
                type="date"
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                min={fechaEntrada}
              />
            </div>
          </div>

          <div className="campo">
            <label>Precio de compra unitario</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={precioCompra}
              onChange={(e) => setPrecioCompra(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="info-lote">
            <Boxes size={16} />
            <div>
              <strong>Sistema FIFO</strong>
              <p>
                Los lotes más antiguos (por fecha de entrada) se venderán primero
                automáticamente en el Punto de Venta.
              </p>
            </div>
          </div>

          <div className="modal-acciones">
            <button
              type="button"
              className="btn-secundario"
              onClick={() => setModalAbierto(false)}
              disabled={guardando}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primario-chico" disabled={guardando}>
              {guardando ? "Guardando..." : editando ? "Actualizar" : "Crear lote"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmar eliminación */}
      <ConfirmDialog
        abierto={!!porEliminar}
        titulo="Eliminar lote"
        mensaje={
          porEliminar
            ? `¿Estás seguro de eliminar este lote de "${porEliminar.producto_nombre}"? Esta acción no se puede deshacer.`
            : ""
        }
        onConfirmar={confirmarEliminar}
        onCancelar={() => setPorEliminar(null)}
        cargando={eliminando}
      />
    </Layout>
  );
}