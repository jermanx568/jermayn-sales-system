import { useEffect, useState, useMemo } from "react";
import type { FormEvent } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Gift,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Package,
  X,
  TrendingDown,
} from "lucide-react";
import Layout from "../components/Layout";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import { supabase } from "../lib/supabase";
import { useToast } from "../hooks/useToast";
import type { ComboConDetalles, Producto, ItemComboForm } from "../types";

type OrdenCampo = "nombre" | "precio_combo" | "prioridad" | "created_at";
type OrdenDir = "asc" | "desc";

const POR_PAGINA = 10;

const COLORES_COMBO = [
  "#2563eb", "#7c3aed", "#db2777", "#dc2626",
  "#ea580c", "#ca8a04", "#16a34a", "#0891b2",
];

export default function Combos() {
  const toast = useToast();

  const [combos, setCombos] = useState<ComboConDetalles[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "activos" | "inactivos">("todos");
  const [ordenCampo, setOrdenCampo] = useState<OrdenCampo>("prioridad");
  const [ordenDir, setOrdenDir] = useState<OrdenDir>("desc");
  const [pagina, setPagina] = useState(1);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<ComboConDetalles | null>(null);

  // Formulario
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precioCombo, setPrecioCombo] = useState(0);
  const [imagenColor, setImagenColor] = useState(COLORES_COMBO[0]);
  const [prioridad, setPrioridad] = useState(0);
  const [activo, setActivo] = useState(true);
  const [itemsCombo, setItemsCombo] = useState<ItemComboForm[]>([]);
  const [guardando, setGuardando] = useState(false);

  const [porEliminar, setPorEliminar] = useState<ComboConDetalles | null>(null);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    cargarTodo();
  }, []);

  async function cargarTodo() {
    setCargando(true);

    const [combosRes, prodRes] = await Promise.all([
      supabase
        .from("combos")
        .select(`
          *,
          combos_productos (
            id,
            producto_id,
            cantidad,
            productos:producto_id (codigo, nombre, precio_venta)
          )
        `)
        .order("prioridad", { ascending: false }),
      supabase.from("productos").select("*").eq("activo", true).order("nombre"),
    ]);

    if (combosRes.error) {
      toast.error("Error al cargar combos: " + combosRes.error.message);
    } else {
      const mapped: ComboConDetalles[] = (combosRes.data || []).map((c: any) => {
        const productosDetalle = (c.combos_productos || []).map((cp: any) => {
          const precioUnit = Number(cp.productos?.precio_venta || 0);
          return {
            id: cp.id,
            combo_id: c.id,
            producto_id: cp.producto_id,
            cantidad: cp.cantidad,
            producto_codigo: cp.productos?.codigo ?? "—",
            producto_nombre: cp.productos?.nombre ?? "—",
            producto_precio: precioUnit,
            producto_stock: 0,
            subtotal: precioUnit * cp.cantidad,
          };
        });

        const precioOriginal = productosDetalle.reduce(
          (acc: number, p: any) => acc + p.subtotal,
          0
        );
        const precioCombo = Number(c.precio_combo);
        const ahorro = precioOriginal - precioCombo;
        const porcentaje = precioOriginal > 0 ? (ahorro / precioOriginal) * 100 : 0;

        return {
          ...c,
          precio_combo: precioCombo,
          precio_original: precioOriginal,
          productos: productosDetalle,
          productos_count: productosDetalle.length,
          ahorro,
          porcentaje_ahorro: porcentaje,
        };
      });
      setCombos(mapped);
    }

    if (!prodRes.error) setProductos(prodRes.data || []);
    setCargando(false);
  }

  // ==================== FILTRADO ====================
  const combosFiltrados = useMemo(() => {
    let resultado = [...combos];

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      resultado = resultado.filter(
        (c) =>
          c.nombre.toLowerCase().includes(q) ||
          (c.codigo || "").toLowerCase().includes(q)
      );
    }

    if (filtroEstado === "activos") resultado = resultado.filter((c) => c.activo);
    if (filtroEstado === "inactivos") resultado = resultado.filter((c) => !c.activo);

    resultado.sort((a, b) => {
      const av = (a[ordenCampo] ?? "") as any;
      const bv = (b[ordenCampo] ?? "") as any;
      if (av < bv) return ordenDir === "asc" ? -1 : 1;
      if (av > bv) return ordenDir === "asc" ? 1 : -1;
      return 0;
    });

    return resultado;
  }, [combos, busqueda, filtroEstado, ordenCampo, ordenDir]);

  const totalPaginas = Math.max(1, Math.ceil(combosFiltrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const combosPagina = combosFiltrados.slice(
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
    setNombre("");
    setCodigo("");
    setDescripcion("");
    setPrecioCombo(0);
    setImagenColor(COLORES_COMBO[0]);
    setPrioridad(0);
    setActivo(true);
    setItemsCombo([]);
    setModalAbierto(true);
  }

  function abrirEditar(combo: ComboConDetalles) {
    setEditando(combo);
    setNombre(combo.nombre);
    setCodigo(combo.codigo || "");
    setDescripcion(combo.descripcion || "");
    setPrecioCombo(combo.precio_combo);
    setImagenColor(combo.imagen_color || COLORES_COMBO[0]);
    setPrioridad(combo.prioridad);
    setActivo(combo.activo);
    setItemsCombo(
      combo.productos.map((p) => ({
        producto_id: p.producto_id,
        cantidad: p.cantidad,
      }))
    );
    setModalAbierto(true);
  }

  function agregarProducto() {
    const disponibles = productos.filter(
      (p) => !itemsCombo.some((i) => i.producto_id === p.id)
    );
    if (disponibles.length === 0) {
      toast.info("Ya agregaste todos los productos disponibles");
      return;
    }
    setItemsCombo([...itemsCombo, { producto_id: "", cantidad: 1 }]);
  }

  function actualizarItem(index: number, campo: keyof ItemComboForm, valor: any) {
    setItemsCombo(
      itemsCombo.map((item, i) =>
        i === index ? { ...item, [campo]: valor } : item
      )
    );
  }

  function eliminarItem(index: number) {
    setItemsCombo(itemsCombo.filter((_, i) => i !== index));
  }

  // Precio original calculado en tiempo real
  const precioOriginalCalculado = useMemo(() => {
    return itemsCombo.reduce((acc, item) => {
      if (!item.producto_id) return acc;
      const prod = productos.find((p) => p.id === item.producto_id);
      return acc + (prod ? Number(prod.precio_venta) * item.cantidad : 0);
    }, 0);
  }, [itemsCombo, productos]);

  const ahorroCalculado = precioOriginalCalculado - precioCombo;
  const porcentajeAhorro =
    precioOriginalCalculado > 0
      ? (ahorroCalculado / precioOriginalCalculado) * 100
      : 0;

  async function guardar(e: FormEvent) {
    e.preventDefault();

    if (!nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (itemsCombo.length === 0) {
      toast.error("Agrega al menos un producto al combo");
      return;
    }
    if (itemsCombo.some((i) => !i.producto_id)) {
      toast.error("Todos los items deben tener un producto seleccionado");
      return;
    }
    if (itemsCombo.some((i) => i.cantidad < 1)) {
      toast.error("Todas las cantidades deben ser al menos 1");
      return;
    }
    if (precioCombo <= 0) {
      toast.error("El precio del combo debe ser mayor a 0");
      return;
    }
    if (precioCombo >= precioOriginalCalculado) {
      toast.error(
        "El precio del combo debe ser menor al precio original (" +
          precioOriginalCalculado.toFixed(2) +
          ")"
      );
      return;
    }

    setGuardando(true);

    try {
      const payloadCombo: any = {
        nombre: nombre.trim(),
        codigo: codigo.trim().toUpperCase() || null,
        descripcion: descripcion.trim() || null,
        precio_combo: precioCombo,
        precio_original: precioOriginalCalculado,
        imagen_color: imagenColor,
        prioridad,
        activo,
      };

      let comboId: string;

      if (editando) {
        const { error } = await supabase
          .from("combos")
          .update(payloadCombo)
          .eq("id", editando.id);
        if (error) throw new Error("Error al actualizar: " + error.message);
        comboId = editando.id;

        // Borrar items anteriores
        await supabase.from("combos_productos").delete().eq("combo_id", comboId);
      } else {
        const { data, error } = await supabase
          .from("combos")
          .insert(payloadCombo)
          .select()
          .single();
        if (error || !data) throw new Error("Error al crear: " + error?.message);
        comboId = data.id;
      }

      // Insertar items
      const itemsPayload = itemsCombo.map((i) => ({
        combo_id: comboId,
        producto_id: i.producto_id,
        cantidad: i.cantidad,
      }));

      const { error: itemsError } = await supabase
        .from("combos_productos")
        .insert(itemsPayload);

      if (itemsError) throw new Error("Error al guardar items: " + itemsError.message);

      toast.exito(editando ? "Combo actualizado" : "Combo creado");
      setModalAbierto(false);
      cargarTodo();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminar() {
    if (!porEliminar) return;
    setEliminando(true);
    const { error } = await supabase.from("combos").delete().eq("id", porEliminar.id);
    setEliminando(false);
    if (error) {
      toast.error("Error al eliminar: " + error.message);
    } else {
      toast.exito("Combo eliminado");
      setPorEliminar(null);
      cargarTodo();
    }
  }

  async function toggleActivo(combo: ComboConDetalles) {
    const { error } = await supabase
      .from("combos")
      .update({ activo: !combo.activo })
      .eq("id", combo.id);
    if (error) {
      toast.error("Error al cambiar estado: " + error.message);
    } else {
      toast.info(combo.activo ? "Combo desactivado" : "Combo activado");
      cargarTodo();
    }
  }

  function formatoMoneda(n: number) {
    return "$" + Number(n).toFixed(2);
  }

  const productosDisponibles = (indexActual: number) => {
    return productos.filter(
      (p) =>
        !itemsCombo.some(
          (i, idx) => i.producto_id === p.id && idx !== indexActual
        )
    );
  };

  // ==================== RENDER ====================
  return (
    <Layout>
      <div className="page-header">
        <div>
          <h2>Combos</h2>
          <p>Arma paquetes de productos con precios especiales</p>
        </div>
        <button className="btn-primario-chico" onClick={abrirCrear}>
          <Plus size={18} />
          Nuevo combo
        </button>
      </div>

      <div className="card-panel">
        <div className="tabla-toolbar">
          <div className="tabla-busqueda">
            <Search size={16} />
            <input
              type="text"
              placeholder="Buscar combos..."
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
            <option value="todos">Todos</option>
            <option value="activos">Solo activos</option>
            <option value="inactivos">Solo inactivos</option>
          </select>
        </div>

        {cargando ? (
          <p className="texto-vacio">Cargando...</p>
        ) : combosFiltrados.length === 0 ? (
          <p className="texto-vacio">
            {busqueda || filtroEstado !== "todos"
              ? "No se encontraron combos con esos filtros"
              : "No hay combos aún. Crea el primero."}
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
                      Combo {iconoOrden("nombre")}
                    </span>
                  </th>
                  <th>Productos</th>
                  <th>P. Original</th>
                  <th
                    className="th-ordenable"
                    onClick={() => cambiarOrden("precio_combo")}
                  >
                    <span className="th-contenido">
                      P. Combo {iconoOrden("precio_combo")}
                    </span>
                  </th>
                  <th>Ahorro</th>
                  <th style={{ width: "100px" }}>Estado</th>
                  <th style={{ width: "120px" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {combosPagina.map((combo) => (
                  <tr key={combo.id}>
                    <td>
                      <div className="celda-con-icono">
                        <div
                          className="celda-icono"
                          style={{
                            backgroundColor: combo.imagen_color + "20",
                            color: combo.imagen_color,
                          }}
                        >
                          <Gift size={16} />
                        </div>
                        <div>
                          <strong>{combo.nombre}</strong>
                          {combo.codigo && (
                            <div className="texto-muted" style={{ fontSize: 11, fontFamily: "Consolas, monospace" }}>
                              {combo.codigo}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge-productos">
                        <Package size={14} />
                        {combo.productos_count}
                      </span>
                    </td>
                    <td className="texto-muted">
                      <span style={{ textDecoration: "line-through" }}>
                        {formatoMoneda(combo.precio_original)}
                      </span>
                    </td>
                    <td>
                      <strong>{formatoMoneda(combo.precio_combo)}</strong>
                    </td>
                    <td>
                      <span className="badge-ahorro">
                        <TrendingDown size={12} />
                        {combo.porcentaje_ahorro.toFixed(0)}%
                      </span>
                    </td>
                    <td>
                      <button
                        className={
                          "badge-estado " +
                          (combo.activo ? "badge-activa" : "badge-inactiva")
                        }
                        onClick={() => toggleActivo(combo)}
                        title="Clic para cambiar estado"
                      >
                        {combo.activo ? "Activo" : "Inactivo"}
                      </button>
                    </td>
                    <td>
                      <div className="acciones-tabla">
                        <button
                          className="btn-icono"
                          onClick={() => abrirEditar(combo)}
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="btn-icono btn-icono-peligro"
                          onClick={() => setPorEliminar(combo)}
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
                  {Math.min(paginaActual * POR_PAGINA, combosFiltrados.length)} de{" "}
                  {combosFiltrados.length}
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
        titulo={editando ? "Editar combo" : "Nuevo combo"}
      >
        <form onSubmit={guardar}>
          <div className="form-grid-2">
            <div className="campo">
              <label>Nombre *</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                placeholder="Ej: Combo Desayuno"
                autoFocus
              />
            </div>

            <div className="campo">
              <label>Código</label>
              <input
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="Ej: COMBO-001"
                maxLength={20}
              />
            </div>
          </div>

          <div className="campo">
            <label>Descripción</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describe el combo (opcional)"
              rows={2}
            />
          </div>

          <div className="campo">
            <label>Color del combo</label>
            <div className="colores-grid">
              {COLORES_COMBO.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={
                    "color-opcion" + (imagenColor === c ? " color-opcion-activo" : "")
                  }
                  style={{ backgroundColor: c }}
                  onClick={() => setImagenColor(c)}
                />
              ))}
            </div>
          </div>

          {/* ========== PRODUCTOS DEL COMBO ========== */}
          <div className="combo-productos-section">
            <div className="combo-productos-header">
              <label>Productos del combo *</label>
              <button
                type="button"
                className="btn-agregar-item"
                onClick={agregarProducto}
              >
                <Plus size={14} />
                Agregar producto
              </button>
            </div>

            {itemsCombo.length === 0 ? (
              <p className="texto-vacio" style={{ padding: "20px 0", fontSize: 13 }}>
                Agrega los productos que incluirá el combo
              </p>
            ) : (
              <div className="combo-items">
                {itemsCombo.map((item, index) => {
                  const prod = productos.find((p) => p.id === item.producto_id);
                  const subtotal = prod
                    ? Number(prod.precio_venta) * item.cantidad
                    : 0;
                  return (
                    <div key={index} className="combo-item">
                      <select
                        value={item.producto_id}
                        onChange={(e) =>
                          actualizarItem(index, "producto_id", e.target.value)
                        }
                        className="select-filtro"
                        style={{ flex: 1, padding: "8px 10px", fontSize: 13 }}
                      >
                        <option value="">Seleccionar producto...</option>
                        {productosDisponibles(index).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.codigo} — {p.nombre} (${Number(p.precio_venta).toFixed(2)})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        value={item.cantidad}
                        onChange={(e) =>
                          actualizarItem(
                            index,
                            "cantidad",
                            parseInt(e.target.value) || 1
                          )
                        }
                        className="combo-item-cantidad"
                      />

                      <span className="combo-item-subtotal">
                        {formatoMoneda(subtotal)}
                      </span>

                      <button
                        type="button"
                        className="btn-icono btn-icono-peligro"
                        onClick={() => eliminarItem(index)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ========== RESUMEN DE PRECIOS ========== */}
          {itemsCombo.length > 0 && itemsCombo.some((i) => i.producto_id) && (
            <div className="combo-resumen-precios">
              <div className="combo-precio-linea">
                <span>Precio original (suma):</span>
                <span style={{ textDecoration: "line-through", color: "#94a3b8" }}>
                  {formatoMoneda(precioOriginalCalculado)}
                </span>
              </div>
              <div className="combo-precio-linea combo-precio-final">
                <span>Ahorro para el cliente:</span>
                <span className={ahorroCalculado > 0 ? "texto-verde" : "texto-rojo"}>
                  {ahorroCalculado >= 0 ? "-" : "+"}
                  {formatoMoneda(Math.abs(ahorroCalculado))}{" "}
                  ({porcentajeAhorro.toFixed(0)}%)
                </span>
              </div>
            </div>
          )}

          <div className="form-grid-2">
            <div className="campo">
              <label>Precio del combo ($) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={precioCombo}
                onChange={(e) => setPrecioCombo(parseFloat(e.target.value) || 0)}
                required
              />
              {itemsCombo.length > 0 && precioOriginalCalculado > 0 && (
                <small className="texto-muted" style={{ fontSize: 11 }}>
                  Debe ser menor a {formatoMoneda(precioOriginalCalculado)}
                </small>
              )}
            </div>

            <div className="campo">
              <label>Prioridad</label>
              <input
                type="number"
                min="0"
                value={prioridad}
                onChange={(e) => setPrioridad(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="campo">
            <label className="switch-label">
              <input
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
              />
              <span className="switch"></span>
              <span>Combo activo</span>
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
              {guardando ? "Guardando..." : editando ? "Actualizar" : "Crear combo"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        abierto={!!porEliminar}
        titulo="Eliminar combo"
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