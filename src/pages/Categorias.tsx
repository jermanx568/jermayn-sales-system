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
  Package,
} from "lucide-react";
import Layout from "../components/Layout";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import { supabase } from "../lib/supabase";
import { useToast } from "../hooks/useToast";
import type { CategoriaConConteo } from "../types";

type OrdenCampo = "nombre" | "codigo" | "orden" | "created_at";
type OrdenDir = "asc" | "desc";

const POR_PAGINA = 10;

const COLORES_DISPONIBLES = [
  "#2563eb", "#7c3aed", "#db2777", "#dc2626",
  "#ea580c", "#ca8a04", "#16a34a", "#0891b2",
  "#475569", "#0f172a",
];

export default function Categorias() {
  const toast = useToast();

  const [categorias, setCategorias] = useState<CategoriaConConteo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todas" | "activas" | "inactivas">("todas");
  const [ordenCampo, setOrdenCampo] = useState<OrdenCampo>("nombre");
  const [ordenDir, setOrdenDir] = useState<OrdenDir>("asc");
  const [pagina, setPagina] = useState(1);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<CategoriaConConteo | null>(null);

  // Formulario
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [color, setColor] = useState(COLORES_DISPONIBLES[0]);
  const [activa, setActiva] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Confirmar eliminación
  const [porEliminar, setPorEliminar] = useState<CategoriaConConteo | null>(null);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    cargarCategorias();
  }, []);

  async function cargarCategorias() {
    setCargando(true);

    // Traemos categorias + conteo de productos relacionados
    const { data, error } = await supabase
      .from("categorias")
      .select(`
        *,
        productos:productos(count)
      `)
      .order("nombre", { ascending: true });

    if (error) {
      toast.error("Error al cargar categorías: " + error.message);
      setCargando(false);
      return;
    }

    // Mapeamos para extraer el conteo
    const categoriasConConteo: CategoriaConConteo[] = (data || []).map((c: any) => ({
      ...c,
      productos_count: c.productos?.[0]?.count ?? 0,
    }));

    setCategorias(categoriasConConteo);
    setCargando(false);
  }

  // ==================== FILTRADO, ORDEN Y PAGINACION ====================
  const categoriasFiltradas = useMemo(() => {
    let resultado = [...categorias];

    // Búsqueda por nombre o código
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      resultado = resultado.filter(
        (c) =>
          c.nombre.toLowerCase().includes(q) ||
          (c.codigo || "").toLowerCase().includes(q)
      );
    }

    // Filtro por estado
    if (filtroEstado === "activas") resultado = resultado.filter((c) => c.activa);
    if (filtroEstado === "inactivas") resultado = resultado.filter((c) => !c.activa);

    // Ordenamiento
    resultado.sort((a, b) => {
      const av = (a[ordenCampo] ?? "") as any;
      const bv = (b[ordenCampo] ?? "") as any;
      if (av < bv) return ordenDir === "asc" ? -1 : 1;
      if (av > bv) return ordenDir === "asc" ? 1 : -1;
      return 0;
    });

    return resultado;
  }, [categorias, busqueda, filtroEstado, ordenCampo, ordenDir]);

  const totalPaginas = Math.max(1, Math.ceil(categoriasFiltradas.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const categoriasPagina = categoriasFiltradas.slice(
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
    setColor(COLORES_DISPONIBLES[0]);
    setActiva(true);
    setModalAbierto(true);
  }

  function abrirEditar(cat: CategoriaConConteo) {
    setEditando(cat);
    setNombre(cat.nombre);
    setCodigo(cat.codigo || "");
    setDescripcion(cat.descripcion || "");
    setColor(cat.color || COLORES_DISPONIBLES[0]);
    setActiva(cat.activa);
    setModalAbierto(true);
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;

    // Validar nombre duplicado
    const nombreDuplicado = categorias.find(
      (c) =>
        c.nombre.toLowerCase().trim() === nombre.toLowerCase().trim() &&
        c.id !== editando?.id
    );
    if (nombreDuplicado) {
      toast.error("Ya existe una categoría con ese nombre");
      return;
    }

    // Validar código duplicado
    if (codigo.trim()) {
      const codigoDuplicado = categorias.find(
        (c) =>
          (c.codigo || "").toLowerCase().trim() === codigo.toLowerCase().trim() &&
          c.id !== editando?.id
      );
      if (codigoDuplicado) {
        toast.error("Ya existe una categoría con ese código");
        return;
      }
    }

    setGuardando(true);

    const payload = {
      nombre: nombre.trim(),
      codigo: codigo.trim() || null,
      descripcion: descripcion.trim() || null,
      color,
      activa,
    };

    if (editando) {
      const { error } = await supabase
        .from("categorias")
        .update(payload)
        .eq("id", editando.id);

      if (error) {
        toast.error("Error al actualizar: " + error.message);
      } else {
        toast.exito("Categoría actualizada correctamente");
        setModalAbierto(false);
        cargarCategorias();
      }
    } else {
      const { error } = await supabase.from("categorias").insert(payload);

      if (error) {
        toast.error("Error al crear: " + error.message);
      } else {
        toast.exito("Categoría creada correctamente");
        setModalAbierto(false);
        cargarCategorias();
      }
    }

    setGuardando(false);
  }

  async function confirmarEliminar() {
    if (!porEliminar) return;

    // Si tiene productos, no permitir eliminar
    if ((porEliminar.productos_count ?? 0) > 0) {
      toast.error(
        `No se puede eliminar: tiene ${porEliminar.productos_count} producto(s) asociado(s)`
      );
      setPorEliminar(null);
      return;
    }

    setEliminando(true);
    const { error } = await supabase
      .from("categorias")
      .delete()
      .eq("id", porEliminar.id);

    setEliminando(false);

    if (error) {
      toast.error("Error al eliminar: " + error.message);
    } else {
      toast.exito("Categoría eliminada");
      setPorEliminar(null);
      cargarCategorias();
    }
  }

  async function toggleActiva(cat: CategoriaConConteo) {
    const { error } = await supabase
      .from("categorias")
      .update({ activa: !cat.activa })
      .eq("id", cat.id);

    if (error) {
      toast.error("Error al cambiar estado: " + error.message);
    } else {
      toast.info(cat.activa ? "Categoría desactivada" : "Categoría activada");
      cargarCategorias();
    }
  }

  // ==================== RENDER ====================
  return (
    <Layout>
      <div className="page-header">
        <div>
          <h2>Categorías</h2>
          <p>Gestiona las categorías de tus productos</p>
        </div>
        <button className="btn-primario-chico" onClick={abrirCrear}>
          <Plus size={18} />
          Nueva categoría
        </button>
      </div>

      <div className="card-panel">
        {/* Barra de herramientas */}
        <div className="tabla-toolbar">
          <div className="tabla-busqueda">
            <Search size={16} />
            <input
              type="text"
              placeholder="Buscar por nombre o código..."
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
        ) : categoriasFiltradas.length === 0 ? (
          <p className="texto-vacio">
            {busqueda || filtroEstado !== "todas"
              ? "No se encontraron categorías con esos filtros"
              : "No hay categorías aún. Crea la primera."}
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
                  <th
                    className="th-ordenable"
                    onClick={() => cambiarOrden("codigo")}
                  >
                    <span className="th-contenido">
                      Código {iconoOrden("codigo")}
                    </span>
                  </th>
                  <th>Descripción</th>
                  <th style={{ width: "110px" }}>Productos</th>
                  <th style={{ width: "100px" }}>Estado</th>
                  <th style={{ width: "120px" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {categoriasPagina.map((cat) => (
                  <tr key={cat.id}>
                    <td>
                      <div className="celda-con-icono">
                        <div
                          className="celda-icono"
                          style={{
                            backgroundColor: cat.color + "20",
                            color: cat.color,
                          }}
                        >
                          <Tag size={16} />
                        </div>
                        <strong>{cat.nombre}</strong>
                      </div>
                    </td>
                    <td>
                      {cat.codigo ? (
                        <span className="badge-codigo">{cat.codigo}</span>
                      ) : (
                        <span className="texto-muted">—</span>
                      )}
                    </td>
                    <td className="texto-muted">
                      {cat.descripcion || "Sin descripción"}
                    </td>
                    <td>
                      <span className="badge-productos">
                        <Package size={14} />
                        {cat.productos_count ?? 0}
                      </span>
                    </td>
                    <td>
                      <button
                        className={
                          "badge-estado " +
                          (cat.activa ? "badge-activa" : "badge-inactiva")
                        }
                        onClick={() => toggleActiva(cat)}
                        title="Clic para cambiar estado"
                      >
                        {cat.activa ? "Activa" : "Inactiva"}
                      </button>
                    </td>
                    <td>
                      <div className="acciones-tabla">
                        <button
                          className="btn-icono"
                          onClick={() => abrirEditar(cat)}
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="btn-icono btn-icono-peligro"
                          onClick={() => setPorEliminar(cat)}
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

            {/* Paginación */}
            {totalPaginas > 1 && (
              <div className="paginacion">
                <span className="paginacion-info">
                  Mostrando {(paginaActual - 1) * POR_PAGINA + 1}–
                  {Math.min(paginaActual * POR_PAGINA, categoriasFiltradas.length)} de{" "}
                  {categoriasFiltradas.length}
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
        titulo={editando ? "Editar categoría" : "Nueva categoría"}
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
                placeholder="Ej: Bebidas"
                autoFocus
              />
            </div>

            <div className="campo">
              <label>Código</label>
              <input
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="Ej: CAT-001"
                maxLength={20}
              />
            </div>
          </div>

          <div className="campo">
            <label>Descripción</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción opcional"
              rows={3}
            />
          </div>

          <div className="campo">
            <label>Color</label>
            <div className="colores-grid">
              {COLORES_DISPONIBLES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={
                    "color-opcion" + (color === c ? " color-opcion-activo" : "")
                  }
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  title={c}
                />
              ))}
            </div>
          </div>

          <div className="campo">
            <label className="switch-label">
              <input
                type="checkbox"
                checked={activa}
                onChange={(e) => setActiva(e.target.checked)}
              />
              <span className="switch"></span>
              <span>Categoría activa</span>
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

      {/* Modal Confirmar Eliminación */}
      <ConfirmDialog
        abierto={!!porEliminar}
        titulo="Eliminar categoría"
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