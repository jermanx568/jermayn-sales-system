import { useEffect, useState, useMemo } from "react";
import type { FormEvent } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Package,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Layout from "../components/Layout";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import { supabase } from "../lib/supabase";
import { useToast } from "../hooks/useToast";
import type { ProductoConDetalles, Categoria } from "../types";

type OrdenCampo = "nombre" | "codigo" | "precio_venta" | "created_at";
type OrdenDir = "asc" | "desc";

const POR_PAGINA = 10;

const UNIDADES = ["unidad", "kg", "litro", "caja", "paquete", "docena"];

export default function Productos() {
  const toast = useToast();

  const [productos, setProductos] = useState<ProductoConDetalles[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "activos" | "inactivos">("todos");
  const [ordenCampo, setOrdenCampo] = useState<OrdenCampo>("nombre");
  const [ordenDir, setOrdenDir] = useState<OrdenDir>("asc");
  const [pagina, setPagina] = useState(1);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<ProductoConDetalles | null>(null);

  // Formulario
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precioCompra, setPrecioCompra] = useState(0);
  const [precioVenta, setPrecioVenta] = useState(0);
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [stockMinimo, setStockMinimo] = useState(5);
  const [unidadMedida, setUnidadMedida] = useState("unidad");
  const [activo, setActivo] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Confirmar eliminacion
  const [porEliminar, setPorEliminar] = useState<ProductoConDetalles | null>(null);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    cargarTodo();
  }, []);

  async function cargarTodo() {
    setCargando(true);

    const [prodRes, catRes] = await Promise.all([
      supabase
        .from("productos")
        .select(`
          *,
          categorias:categoria_id (
            nombre,
            color
          )
        `)
        .order("nombre", { ascending: true }),
      supabase.from("categorias").select("*").order("nombre"),
    ]);

    if (prodRes.error) {
      toast.error("Error al cargar productos: " + prodRes.error.message);
    } else {
      const productosConDetalles: ProductoConDetalles[] = (prodRes.data || []).map((p: any) => ({
        ...p,
        categoria_nombre: p.categorias?.nombre ?? null,
        categoria_color: p.categorias?.color ?? null,
      }));
      setProductos(productosConDetalles);
    }

    if (!catRes.error) {
      setCategorias(catRes.data || []);
    }

    setCargando(false);
  }

  // ==================== FILTRADO, ORDEN Y PAGINACION ====================
  const productosFiltrados = useMemo(() => {
    let resultado = [...productos];

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      resultado = resultado.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          p.codigo.toLowerCase().includes(q) ||
          (p.codigo_barras || "").toLowerCase().includes(q)
      );
    }

    if (filtroCategoria !== "todas") {
      resultado = resultado.filter((p) => p.categoria_id === filtroCategoria);
    }

    if (filtroEstado === "activos") resultado = resultado.filter((p) => p.activo);
    if (filtroEstado === "inactivos") resultado = resultado.filter((p) => !p.activo);

    resultado.sort((a, b) => {
      const av = (a[ordenCampo] ?? "") as any;
      const bv = (b[ordenCampo] ?? "") as any;
      if (av < bv) return ordenDir === "asc" ? -1 : 1;
      if (av > bv) return ordenDir === "asc" ? 1 : -1;
      return 0;
    });

    return resultado;
  }, [productos, busqueda, filtroCategoria, filtroEstado, ordenCampo, ordenDir]);

  const totalPaginas = Math.max(1, Math.ceil(productosFiltrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const productosPagina = productosFiltrados.slice(
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
    setCodigo("");
    setNombre("");
    setDescripcion("");
    setPrecioCompra(0);
    setPrecioVenta(0);
    setCategoriaId("");
    setStockMinimo(5);
    setUnidadMedida("unidad");
    setActivo(true);
    setModalAbierto(true);
  }

  function abrirEditar(prod: ProductoConDetalles) {
    setEditando(prod);
    setCodigo(prod.codigo);
    setNombre(prod.nombre);
    setDescripcion(prod.descripcion || "");
    setPrecioCompra(prod.precio_compra);
    setPrecioVenta(prod.precio_venta);
    setCategoriaId(prod.categoria_id || "");
    setStockMinimo(prod.stock_minimo);
    setUnidadMedida(prod.unidad_medida || "unidad");
    setActivo(prod.activo);
    setModalAbierto(true);
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !codigo.trim()) return;

    // Validar codigo duplicado
    const codigoDuplicado = productos.find(
      (p) =>
        p.codigo.toLowerCase().trim() === codigo.toLowerCase().trim() &&
        p.id !== editando?.id
    );
    if (codigoDuplicado) {
      toast.error("Ya existe un producto con ese código");
      return;
    }

    if (precioVenta < precioCompra) {
      toast.error("El precio de venta no puede ser menor al de compra");
      return;
    }

    setGuardando(true);

    const payload = {
      codigo: codigo.trim().toUpperCase(),
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      precio_compra: precioCompra,
      precio_venta: precioVenta,
      categoria_id: categoriaId || null,
      stock_minimo: stockMinimo,
      unidad_medida: unidadMedida,
      activo,
    };

    if (editando) {
      const { error } = await supabase
        .from("productos")
        .update(payload)
        .eq("id", editando.id);

      if (error) {
        toast.error("Error al actualizar: " + error.message);
      } else {
        toast.exito("Producto actualizado correctamente");
        setModalAbierto(false);
        cargarTodo();
      }
    } else {
      const { error } = await supabase.from("productos").insert(payload);

      if (error) {
        toast.error("Error al crear: " + error.message);
      } else {
        toast.exito("Producto creado correctamente");
        setModalAbierto(false);
        cargarTodo();
      }
    }

    setGuardando(false);
  }

  async function confirmarEliminar() {
    if (!porEliminar) return;
    setEliminando(true);

    const { error } = await supabase
      .from("productos")
      .delete()
      .eq("id", porEliminar.id);

    setEliminando(false);

    if (error) {
      toast.error("Error al eliminar: " + error.message);
    } else {
      toast.exito("Producto eliminado");
      setPorEliminar(null);
      cargarTodo();
    }
  }

  async function toggleActivo(prod: ProductoConDetalles) {
    const { error } = await supabase
      .from("productos")
      .update({ activo: !prod.activo })
      .eq("id", prod.id);

    if (error) {
      toast.error("Error al cambiar estado: " + error.message);
    } else {
      toast.info(prod.activo ? "Producto desactivado" : "Producto activado");
      cargarTodo();
    }
  }

  function formatoMoneda(n: number) {
    return "$" + n.toFixed(2);
  }

  // ==================== RENDER ====================
  return (
    <Layout>
      <div className="page-header">
        <div>
          <h2>Productos</h2>
          <p>Gestiona tu catálogo de productos</p>
        </div>
        <button className="btn-primario-chico" onClick={abrirCrear}>
          <Plus size={18} />
          Nuevo producto
        </button>
      </div>

      <div className="card-panel">
        <div className="tabla-toolbar">
          <div className="tabla-busqueda">
            <Search size={16} />
            <input
              type="text"
              placeholder="Buscar por nombre, código o código de barras..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPagina(1);
              }}
            />
          </div>

          <select
            className="select-filtro"
            value={filtroCategoria}
            onChange={(e) => {
              setFiltroCategoria(e.target.value);
              setPagina(1);
            }}
          >
            <option value="todas">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>

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
        ) : productosFiltrados.length === 0 ? (
          <p className="texto-vacio">
            {busqueda || filtroCategoria !== "todas" || filtroEstado !== "todos"
              ? "No se encontraron productos con esos filtros"
              : "No hay productos aún. Crea el primero."}
          </p>
        ) : (
          <>
            <table className="tabla">
              <thead>
                <tr>
                  <th className="th-ordenable" onClick={() => cambiarOrden("codigo")}>
                    <span className="th-contenido">Código {iconoOrden("codigo")}</span>
                  </th>
                  <th className="th-ordenable" onClick={() => cambiarOrden("nombre")}>
                    <span className="th-contenido">Nombre {iconoOrden("nombre")}</span>
                  </th>
                  <th>Categoría</th>
                  <th className="th-ordenable" onClick={() => cambiarOrden("precio_venta")}>
                    <span className="th-contenido">
                      P. Venta {iconoOrden("precio_venta")}
                    </span>
                  </th>
                  <th>Stock mín.</th>
                  <th style={{ width: "100px" }}>Estado</th>
                  <th style={{ width: "120px" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {productosPagina.map((prod) => (
                  <tr key={prod.id}>
                    <td>
                      <span className="badge-codigo">{prod.codigo}</span>
                    </td>
                    <td>
                      <div className="celda-con-icono">
                        <div className="celda-icono">
                          <Package size={16} />
                        </div>
                        <div>
                          <strong>{prod.nombre}</strong>
                          {prod.descripcion && (
                            <div className="texto-muted" style={{ fontSize: 12 }}>
                              {prod.descripcion}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      {prod.categoria_nombre ? (
                        <span
                          className="badge-categoria"
                          style={{
                            backgroundColor: (prod.categoria_color || "#2563eb") + "20",
                            color: prod.categoria_color || "#2563eb",
                          }}
                        >
                          {prod.categoria_nombre}
                        </span>
                      ) : (
                        <span className="texto-muted">Sin categoría</span>
                      )}
                    </td>
                    <td>
                      <strong>{formatoMoneda(prod.precio_venta)}</strong>
                    </td>
                    <td>
                      <span className="badge-productos">{prod.stock_minimo}</span>
                    </td>
                    <td>
                      <button
                        className={
                          "badge-estado " +
                          (prod.activo ? "badge-activa" : "badge-inactiva")
                        }
                        onClick={() => toggleActivo(prod)}
                        title="Clic para cambiar estado"
                      >
                        {prod.activo ? "Activo" : "Inactivo"}
                      </button>
                    </td>
                    <td>
                      <div className="acciones-tabla">
                        <button
                          className="btn-icono"
                          onClick={() => abrirEditar(prod)}
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="btn-icono btn-icono-peligro"
                          onClick={() => setPorEliminar(prod)}
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
                  {Math.min(paginaActual * POR_PAGINA, productosFiltrados.length)} de{" "}
                  {productosFiltrados.length}
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
        titulo={editando ? "Editar producto" : "Nuevo producto"}
      >
        <form onSubmit={guardar}>
          <div className="form-grid-2">
            <div className="campo">
              <label>Código *</label>
              <input
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                required
                placeholder="Ej: PROD-001"
                maxLength={30}
                autoFocus
              />
            </div>

            <div className="campo">
              <label>Unidad de medida</label>
              <select
                value={unidadMedida}
                onChange={(e) => setUnidadMedida(e.target.value)}
                className="select-filtro"
                style={{ width: "100%", padding: "11px 14px" }}
              >
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="campo">
            <label>Nombre *</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              placeholder="Ej: Coca Cola 2L"
            />
          </div>

          <div className="campo">
            <label>Descripción</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción opcional"
              rows={2}
            />
          </div>

          <div className="form-grid-2">
            <div className="campo">
              <label>Precio compra *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={precioCompra}
                onChange={(e) => setPrecioCompra(parseFloat(e.target.value) || 0)}
                required
              />
            </div>

            <div className="campo">
              <label>Precio venta *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={precioVenta}
                onChange={(e) => setPrecioVenta(parseFloat(e.target.value) || 0)}
                required
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="campo">
              <label>Categoría</label>
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className="select-filtro"
                style={{ width: "100%", padding: "11px 14px" }}
              >
                <option value="">Sin categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="campo">
              <label>Stock mínimo</label>
              <input
                type="number"
                min="0"
                value={stockMinimo}
                onChange={(e) => setStockMinimo(parseInt(e.target.value) || 0)}
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
              <span>Producto activo</span>
            </label>
          </div>

          {/* Info del margen de ganancia */}
          {precioVenta > 0 && precioCompra >= 0 && (
            <div className="info-margen">
              <span>Margen de ganancia:</span>
              <strong>
                {precioVenta > 0
                  ? (((precioVenta - precioCompra) / precioVenta) * 100).toFixed(1)
                  : "0"}
                %
              </strong>
              <span className="texto-muted">
                ({formatoMoneda(precioVenta - precioCompra)} por unidad)
              </span>
            </div>
          )}

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
              {guardando ? "Guardando..." : editando ? "Actualizar" : "Crear"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmar eliminación */}
      <ConfirmDialog
        abierto={!!porEliminar}
        titulo="Eliminar producto"
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