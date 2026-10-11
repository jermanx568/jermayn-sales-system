import { useEffect, useState, useMemo } from "react";
import type { FormEvent } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Tag,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Percent,
  Gift,
  Package,
} from "lucide-react";
import Layout from "../components/Layout";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import { supabase } from "../lib/supabase";
import { useToast } from "../hooks/useToast";
import type { OfertaConDetalles, Categoria, Producto, TipoOferta } from "../types";

type OrdenCampo = "nombre" | "valor" | "created_at" | "prioridad";
type OrdenDir = "asc" | "desc";

const POR_PAGINA = 10;

const TIPOS_OFERTA: { value: TipoOferta; label: string; descripcion: string }[] = [
  {
    value: "porcentaje_categoria",
    label: "% en categoría",
    descripcion: "Descuento a todos los productos de una categoría",
  },
  {
    value: "porcentaje_producto",
    label: "% en producto",
    descripcion: "Descuento a un producto específico",
  },
  {
    value: "2x1",
    label: "2x1 (lleva 2, paga 1)",
    descripcion: "Clásico: por cada 2 unidades se cobra 1",
  },
  {
    value: "cantidad",
    label: "Descuento por cantidad",
    descripcion: "Ej: 3 o más unidades → 20% off",
  },
  {
    value: "precio_fijo",
    label: "Precio fijo por cantidad",
    descripcion: "Ej: 3 unidades por $5",
  },
];

export default function Ofertas() {
  const toast = useToast();

  const [ofertas, setOfertas] = useState<OfertaConDetalles[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todas" | "activas" | "inactivas">("todas");
  const [ordenCampo, setOrdenCampo] = useState<OrdenCampo>("prioridad");
  const [ordenDir, setOrdenDir] = useState<OrdenDir>("desc");
  const [pagina, setPagina] = useState(1);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<OfertaConDetalles | null>(null);

  // Formulario
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState<TipoOferta>("porcentaje_categoria");
  const [valor, setValor] = useState(10);
  const [categoriaId, setCategoriaId] = useState("");
  const [productoId, setProductoId] = useState("");
  const [cantidadMinima, setCantidadMinima] = useState(2);
  const [cantidadGratis, setCantidadGratis] = useState(1);
  const [precioFijo, setPrecioFijo] = useState(0);
  const [prioridad, setPrioridad] = useState(0);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [activa, setActiva] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [porEliminar, setPorEliminar] = useState<OfertaConDetalles | null>(null);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    cargarTodo();
  }, []);

  async function cargarTodo() {
    setCargando(true);

    const [ofRes, catRes, prodRes] = await Promise.all([
      supabase
        .from("ofertas")
        .select(`
          *,
          categorias:categoria_id (nombre, color),
          productos:producto_id (nombre, codigo)
        `)
        .order("prioridad", { ascending: false }),
      supabase.from("categorias").select("*").order("nombre"),
      supabase.from("productos").select("*").eq("activo", true).order("nombre"),
    ]);

    if (ofRes.error) {
      toast.error("Error al cargar ofertas: " + ofRes.error.message);
    } else {
      const mapped: OfertaConDetalles[] = (ofRes.data || []).map((o: any) => ({
        ...o,
        valor: Number(o.valor),
        precio_fijo: o.precio_fijo != null ? Number(o.precio_fijo) : null,
        categoria_nombre: o.categorias?.nombre ?? null,
        categoria_color: o.categorias?.color ?? null,
        producto_nombre: o.productos?.nombre ?? null,
        producto_codigo: o.productos?.codigo ?? null,
        estado_vigencia: calcularVigencia(o),
      }));
      setOfertas(mapped);
    }

    if (!catRes.error) setCategorias(catRes.data || []);
    if (!prodRes.error) setProductos(prodRes.data || []);
    setCargando(false);
  }

  function calcularVigencia(o: any): OfertaConDetalles["estado_vigencia"] {
    if (!o.activa) return "expirada";
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (o.fecha_inicio) {
      const ini = new Date(o.fecha_inicio + "T00:00:00");
      if (ini > hoy) return "programada";
    }
    if (o.fecha_fin) {
      const fin = new Date(o.fecha_fin + "T23:59:59");
      if (fin < hoy) return "expirada";
    }
    return "activa";
  }

  // ==================== FILTRADO ====================
  const ofertasFiltradas = useMemo(() => {
    let resultado = [...ofertas];

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      resultado = resultado.filter(
        (o) =>
          o.nombre.toLowerCase().includes(q) ||
          (o.descripcion || "").toLowerCase().includes(q)
      );
    }

    if (filtroEstado === "activas") resultado = resultado.filter((o) => o.activa);
    if (filtroEstado === "inactivas") resultado = resultado.filter((o) => !o.activa);

    resultado.sort((a, b) => {
      const av = (a[ordenCampo] ?? "") as any;
      const bv = (b[ordenCampo] ?? "") as any;
      if (av < bv) return ordenDir === "asc" ? -1 : 1;
      if (av > bv) return ordenDir === "asc" ? 1 : -1;
      return 0;
    });

    return resultado;
  }, [ofertas, busqueda, filtroEstado, ordenCampo, ordenDir]);

  const totalPaginas = Math.max(1, Math.ceil(ofertasFiltradas.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const ofertasPagina = ofertasFiltradas.slice(
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

  function resetForm() {
    setEditando(null);
    setNombre("");
    setDescripcion("");
    setTipo("porcentaje_categoria");
    setValor(10);
    setCategoriaId("");
    setProductoId("");
    setCantidadMinima(2);
    setCantidadGratis(1);
    setPrecioFijo(0);
    setPrioridad(0);
    setFechaInicio("");
    setFechaFin("");
    setActiva(true);
  }

  function abrirCrear() {
    resetForm();
    setModalAbierto(true);
  }

  function abrirEditar(o: OfertaConDetalles) {
    setEditando(o);
    setNombre(o.nombre);
    setDescripcion(o.descripcion || "");
    setTipo(o.tipo);
    setValor(o.valor);
    setCategoriaId(o.categoria_id || "");
    setProductoId(o.producto_id || "");
    setCantidadMinima(o.cantidad_minima);
    setCantidadGratis(o.cantidad_gratis);
    setPrecioFijo(o.precio_fijo || 0);
    setPrioridad(o.prioridad);
    setFechaInicio(o.fecha_inicio || "");
    setFechaFin(o.fecha_fin || "");
    setActiva(o.activa);
    setModalAbierto(true);
  }

  function validar(): string | null {
    if (!nombre.trim()) return "El nombre es obligatorio";

    if (tipo === "porcentaje_categoria" && !categoriaId)
      return "Selecciona una categoría";
    if (tipo === "porcentaje_producto" && !productoId)
      return "Selecciona un producto";
    if (tipo === "2x1" && !productoId)
      return "Selecciona un producto para el 2x1";

    if (tipo === "porcentaje_categoria" || tipo === "porcentaje_producto") {
      if (valor <= 0 || valor > 100) return "El porcentaje debe estar entre 1 y 100";
    }

    if (tipo === "cantidad") {
      if (cantidadMinima < 2) return "La cantidad mínima debe ser al menos 2";
      if (valor <= 0 || valor > 100) return "El porcentaje debe estar entre 1 y 100";
    }

    if (tipo === "precio_fijo") {
      if (cantidadMinima < 1) return "La cantidad mínima debe ser al menos 1";
      if (precioFijo <= 0) return "El precio fijo debe ser mayor a 0";
    }

    if (fechaInicio && fechaFin && fechaFin < fechaInicio)
      return "La fecha fin no puede ser anterior a la fecha inicio";

    return null;
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const err = validar();
    if (err) {
      toast.error(err);
      return;
    }

    setGuardando(true);

    const payload: any = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      tipo,
      valor: tipo === "precio_fijo" ? 0 : valor,
      categoria_id:
        tipo === "porcentaje_categoria" ? categoriaId || null : null,
      producto_id:
        tipo === "porcentaje_categoria" ? null : productoId || null,
      cantidad_minima: tipo === "cantidad" || tipo === "precio_fijo" ? cantidadMinima : 1,
      cantidad_gratis: tipo === "2x1" ? cantidadGratis : 0,
      precio_fijo: tipo === "precio_fijo" ? precioFijo : null,
      prioridad,
      fecha_inicio: fechaInicio || null,
      fecha_fin: fechaFin || null,
      activa,
    };

    if (editando) {
      const { error } = await supabase
        .from("ofertas")
        .update(payload)
        .eq("id", editando.id);
      if (error) {
        toast.error("Error al actualizar: " + error.message);
      } else {
        toast.exito("Oferta actualizada correctamente");
        setModalAbierto(false);
        cargarTodo();
      }
    } else {
      const { error } = await supabase.from("ofertas").insert(payload);
      if (error) {
        toast.error("Error al crear: " + error.message);
      } else {
        toast.exito("Oferta creada correctamente");
        setModalAbierto(false);
        cargarTodo();
      }
    }

    setGuardando(false);
  }

  async function confirmarEliminar() {
    if (!porEliminar) return;
    setEliminando(true);
    const { error } = await supabase.from("ofertas").delete().eq("id", porEliminar.id);
    setEliminando(false);
    if (error) {
      toast.error("Error al eliminar: " + error.message);
    } else {
      toast.exito("Oferta eliminada");
      setPorEliminar(null);
      cargarTodo();
    }
  }

  async function toggleActiva(o: OfertaConDetalles) {
    const { error } = await supabase
      .from("ofertas")
      .update({ activa: !o.activa })
      .eq("id", o.id);
    if (error) {
      toast.error("Error al cambiar estado: " + error.message);
    } else {
      toast.info(o.activa ? "Oferta desactivada" : "Oferta activada");
      cargarTodo();
    }
  }

  function descripcionOferta(o: OfertaConDetalles): string {
    switch (o.tipo) {
      case "porcentaje_categoria":
        return `${o.valor}% en ${o.categoria_nombre || "categoría"}`;
      case "porcentaje_producto":
        return `${o.valor}% en ${o.producto_nombre || "producto"}`;
      case "2x1":
        return `${o.cantidad_minima + o.cantidad_gratis}x${o.cantidad_minima} en ${o.producto_nombre || "producto"}`;
      case "cantidad":
        return `${o.valor}% desde ${o.cantidad_minima} unidades`;
      case "precio_fijo":
        return `${o.cantidad_minima} por $${Number(o.precio_fijo || 0).toFixed(2)}`;
      default:
        return "";
    }
  }

  function etiquetaVigencia(o: OfertaConDetalles) {
    const clases: Record<string, string> = {
      activa: "badge-estado badge-activa",
      programada: "badge-estado badge-proximo",
      expirada: "badge-estado badge-inactiva",
      "sin-fecha": "badge-estado badge-activa",
    };
    const textos: Record<string, string> = {
      activa: "Activa",
      programada: "Programada",
      expirada: "Expirada",
      "sin-fecha": "Activa",
    };
    return (
      <span className={clases[o.estado_vigencia || "sin-fecha"]}>
        {textos[o.estado_vigencia || "sin-fecha"]}
      </span>
    );
  }

  function formatoMoneda(n: number) {
    return "$" + Number(n).toFixed(2);
  }

  const tipoInfo = TIPOS_OFERTA.find((t) => t.value === tipo);

  // ==================== RENDER ====================
  return (
    <Layout>
      <div className="page-header">
        <div>
          <h2>Ofertas y Descuentos</h2>
          <p>Crea descuentos automáticos que se aplican en el Punto de Venta</p>
        </div>
        <button className="btn-primario-chico" onClick={abrirCrear}>
          <Plus size={18} />
          Nueva oferta
        </button>
      </div>

      <div className="card-panel">
        <div className="tabla-toolbar">
          <div className="tabla-busqueda">
            <Search size={16} />
            <input
              type="text"
              placeholder="Buscar ofertas..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPagina(1);
              }}
            />
          </div>

          <select
            className="select-filtro"
            value={filtroEstado}
            onChange={(e) => {
              setFiltroEstado(e.target.value as any);
              setPagina(1);
            }}
          >
            <option value="todas">Todas</option>
            <option value="activas">Solo activas</option>
            <option value="inactivas">Solo inactivas</option>
          </select>
        </div>

        {cargando ? (
          <p className="texto-vacio">Cargando...</p>
        ) : ofertasFiltradas.length === 0 ? (
          <p className="texto-vacio">
            {busqueda || filtroEstado !== "todas"
              ? "No se encontraron ofertas con esos filtros"
              : "No hay ofertas aún. Crea la primera."}
          </p>
        ) : (
          <>
            <table className="tabla">
              <thead>
                <tr>
                  <th
                    className="th-ordenable"
                    onClick={() => cambiarOrden("nombre")}
                  >
                    <span className="th-contenido">
                      Nombre {iconoOrden("nombre")}
                    </span>
                  </th>
                  <th>Descripción</th>
                  <th
                    className="th-ordenable"
                    onClick={() => cambiarOrden("prioridad")}
                  >
                    <span className="th-contenido">
                      Prioridad {iconoOrden("prioridad")}
                    </span>
                  </th>
                  <th>Vigencia</th>
                  <th style={{ width: "100px" }}>Estado</th>
                  <th style={{ width: "120px" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ofertasPagina.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <div className="celda-con-icono">
                        <div className="celda-icono">
                          {o.tipo === "2x1" ? <Gift size={16} /> : <Tag size={16} />}
                        </div>
                        <div>
                          <strong>{o.nombre}</strong>
                          {o.descripcion && (
                            <div className="texto-muted" style={{ fontSize: 12 }}>
                              {o.descripcion}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge-oferta-desc">
                        {o.tipo === "2x1" && <Gift size={12} />}
                        {o.tipo === "porcentaje_categoria" && <Percent size={12} />}
                        {o.tipo === "porcentaje_producto" && <Percent size={12} />}
                        {o.tipo === "cantidad" && <Package size={12} />}
                        {o.tipo === "precio_fijo" && <Tag size={12} />}
                        {descripcionOferta(o)}
                      </span>
                    </td>
                    <td>
                      <span className="badge-prioridad">{o.prioridad}</span>
                    </td>
                    <td className="texto-muted" style={{ fontSize: 12 }}>
                      {o.fecha_inicio || o.fecha_fin ? (
                        <>
                          {o.fecha_inicio || "—"} → {o.fecha_fin || "∞"}
                        </>
                      ) : (
                        "Sin límite"
                      )}
                    </td>
                    <td>
                      <button
                        className={
                          "badge-estado " +
                          (o.activa ? "badge-activa" : "badge-inactiva")
                        }
                        onClick={() => toggleActiva(o)}
                        title="Clic para cambiar estado"
                      >
                        {o.activa ? "Activa" : "Inactiva"}
                      </button>
                    </td>
                    <td>
                      <div className="acciones-tabla">
                        <button
                          className="btn-icono"
                          onClick={() => abrirEditar(o)}
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="btn-icono btn-icono-peligro"
                          onClick={() => setPorEliminar(o)}
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
                  {Math.min(paginaActual * POR_PAGINA, ofertasFiltradas.length)} de{" "}
                  {ofertasFiltradas.length}
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

      {/* ========== MODAL CREAR/EDITAR ========== */}
      <Modal
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        titulo={editando ? "Editar oferta" : "Nueva oferta"}
      >
        <form onSubmit={guardar}>
          <div className="campo">
            <label>Nombre *</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              placeholder="Ej: Martes de descuento"
              autoFocus
            />
          </div>

          <div className="campo">
            <label>Descripción</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describe la oferta (opcional)"
              rows={2}
            />
          </div>

          <div className="campo">
            <label>Tipo de oferta *</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoOferta)}
              className="select-filtro"
              style={{ width: "100%", padding: "11px 14px" }}
            >
              {TIPOS_OFERTA.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {tipoInfo && (
              <small className="texto-muted" style={{ fontSize: 11, marginTop: 4, display: "block" }}>
                {tipoInfo.descripcion}
              </small>
            )}
          </div>

          {/* Selector según tipo */}
          {(tipo === "porcentaje_categoria") && (
            <div className="campo">
              <label>Categoría *</label>
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className="select-filtro"
                style={{ width: "100%", padding: "11px 14px" }}
                required
              >
                <option value="">Seleccionar categoría...</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(tipo === "porcentaje_producto" || tipo === "2x1") && (
            <div className="campo">
              <label>Producto *</label>
              <select
                value={productoId}
                onChange={(e) => setProductoId(e.target.value)}
                className="select-filtro"
                style={{ width: "100%", padding: "11px 14px" }}
                required
              >
                <option value="">Seleccionar producto...</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo} — {p.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Valor según tipo */}
          {(tipo === "porcentaje_categoria" ||
            tipo === "porcentaje_producto" ||
            tipo === "cantidad") && (
            <div className="campo">
              <label>Porcentaje de descuento (%) *</label>
              <input
                type="number"
                min="1"
                max="100"
                value={valor}
                onChange={(e) => setValor(parseInt(e.target.value) || 0)}
                required
              />
            </div>
          )}

          {tipo === "cantidad" && (
            <div className="campo">
              <label>Cantidad mínima para aplicar *</label>
              <input
                type="number"
                min="2"
                value={cantidadMinima}
                onChange={(e) => setCantidadMinima(parseInt(e.target.value) || 2)}
                required
              />
              <small className="texto-muted" style={{ fontSize: 11 }}>
                Ej: si es 3, aplica desde que llevan 3 unidades
              </small>
            </div>
          )}

          {tipo === "2x1" && (
            <div className="form-grid-2">
              <div className="campo">
                <label>Lleva (cantidad) *</label>
                <input
                  type="number"
                  min="1"
                  value={cantidadMinima + cantidadGratis}
                  onChange={(e) => {
                    const total = parseInt(e.target.value) || 2;
                    setCantidadGratis(Math.max(0, total - cantidadMinima));
                  }}
                  required
                />
              </div>
              <div className="campo">
                <label>Paga (cantidad) *</label>
                <input
                  type="number"
                  min="1"
                  value={cantidadMinima}
                  onChange={(e) => setCantidadMinima(parseInt(e.target.value) || 1)}
                  required
                />
              </div>
            </div>
          )}

          {tipo === "precio_fijo" && (
            <div className="form-grid-2">
              <div className="campo">
                <label>Cantidad *</label>
                <input
                  type="number"
                  min="1"
                  value={cantidadMinima}
                  onChange={(e) => setCantidadMinima(parseInt(e.target.value) || 1)}
                  required
                />
              </div>
              <div className="campo">
                <label>Precio total ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={precioFijo}
                  onChange={(e) => setPrecioFijo(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
            </div>
          )}

          <div className="form-grid-2">
            <div className="campo">
              <label>Fecha inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
            <div className="campo">
              <label>Fecha fin</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                min={fechaInicio || undefined}
              />
            </div>
          </div>

          <div className="campo">
            <label>Prioridad</label>
            <input
              type="number"
              min="0"
              value={prioridad}
              onChange={(e) => setPrioridad(parseInt(e.target.value) || 0)}
            />
            <small className="texto-muted" style={{ fontSize: 11 }}>
              Si hay varias ofertas aplicables, se aplica la de mayor prioridad
            </small>
          </div>

          <div className="campo">
            <label className="switch-label">
              <input
                type="checkbox"
                checked={activa}
                onChange={(e) => setActiva(e.target.checked)}
              />
              <span className="switch"></span>
              <span>Oferta activa</span>
            </label>
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
            <button
              type="submit"
              className="btn-primario-chico"
              disabled={guardando}
            >
              {guardando ? "Guardando..." : editando ? "Actualizar" : "Crear"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        abierto={!!porEliminar}
        titulo="Eliminar oferta"
        mensaje={
          porEliminar
            ? `¿Estás seguro de eliminar "${porEliminar.nombre}"? Esta acción no se puede deshacer.`
            : ""
        }
        onConfirmar={confirmarEliminar}
        onCancelar={() => setPorEliminar(null)}
        cargando={eliminando}
      />
    </Layout>
  );
}