import { useEffect, useState, useMemo } from "react";
import {
  Plus,
  Search,
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Receipt,
} from "lucide-react";
import Layout from "../components/Layout";
import ModalDevolucion from "../components/Modaldevolucion";
import { supabase } from "../lib/supabase";
import { useToast } from "../hooks/useToast";
import type { DevolucionConDetalles } from "../types";

type OrdenCampo = "fecha" | "monto";
type OrdenDir = "asc" | "desc";
type FiltroMotivo = "todos" | string;

const POR_PAGINA = 15;

const MOTIVOS = [
  "Producto dañado",
  "Producto vencido",
  "Cliente arrepentido",
  "Error de cobro",
  "Producto equivocado",
  "Otro",
];

export default function Devoluciones() {
  const toast = useToast();

  const [devoluciones, setDevoluciones] = useState<DevolucionConDetalles[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroMotivo, setFiltroMotivo] = useState<FiltroMotivo>("todos");
  const [ordenCampo, setOrdenCampo] = useState<OrdenCampo>("fecha");
  const [ordenDir, setOrdenDir] = useState<OrdenDir>("desc");
  const [pagina, setPagina] = useState(1);

  const [modalAbierto, setModalAbierto] = useState(false);

  useEffect(() => {
    cargarDevoluciones();
  }, []);

  async function cargarDevoluciones() {
    setCargando(true);

    const { data, error } = await supabase
      .from("devoluciones")
      .select(`
        *,
        ventas:venta_id (numero_factura, cliente_nombre),
        detalle_devoluciones (id)
      `)
      .order("fecha", { ascending: false });

    if (error) {
      toast.error("Error al cargar devoluciones: " + error.message);
    } else {
      const devs: DevolucionConDetalles[] = (data || []).map((d: any) => ({
        ...d,
        monto: Number(d.monto),
        numero_factura: d.ventas?.numero_factura ?? "—",
        cliente_nombre: d.ventas?.cliente_nombre ?? null,
        items_count: d.detalle_devoluciones?.length ?? 0,
      }));
      setDevoluciones(devs);
    }
    setCargando(false);
  }

  // ==================== FILTRADO ====================
  const devolucionesFiltradas = useMemo(() => {
    let resultado = [...devoluciones];

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      resultado = resultado.filter(
        (d) =>
          d.numero_factura.toLowerCase().includes(q) ||
          (d.cliente_nombre || "").toLowerCase().includes(q) ||
          d.motivo.toLowerCase().includes(q)
      );
    }

    if (filtroMotivo !== "todos") {
      resultado = resultado.filter((d) => d.motivo === filtroMotivo);
    }

    resultado.sort((a, b) => {
      const av = (a[ordenCampo] ?? "") as any;
      const bv = (b[ordenCampo] ?? "") as any;
      if (av < bv) return ordenDir === "asc" ? -1 : 1;
      if (av > bv) return ordenDir === "asc" ? 1 : -1;
      return 0;
    });

    return resultado;
  }, [devoluciones, busqueda, filtroMotivo, ordenCampo, ordenDir]);

  const totalPaginas = Math.max(1, Math.ceil(devolucionesFiltradas.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const devolucionesPagina = devolucionesFiltradas.slice(
    (paginaActual - 1) * POR_PAGINA,
    paginaActual * POR_PAGINA
  );

  const montoTotal = devolucionesFiltradas.reduce((acc, d) => acc + d.monto, 0);

  function cambiarOrden(campo: OrdenCampo) {
    if (ordenCampo === campo) {
      setOrdenDir(ordenDir === "asc" ? "desc" : "asc");
    } else {
      setOrdenCampo(campo);
      setOrdenDir(campo === "fecha" ? "desc" : "asc");
    }
  }

  function iconoOrden(campo: OrdenCampo) {
    if (ordenCampo !== campo) return <ArrowUpDown size={14} />;
    return ordenDir === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  }

  function formatoMoneda(n: number) {
    return "$" + Number(n).toFixed(2);
  }

  function formatoFecha(fecha: string) {
    const d = new Date(fecha);
    return d.toLocaleString("es-VE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h2>Devoluciones</h2>
          <p>Gestiona las devoluciones de tus ventas</p>
        </div>
        <button className="btn-primario-chico" onClick={() => setModalAbierto(true)}>
          <Plus size={18} />
          Nueva devolución
        </button>
      </div>

      <div className="card-panel">
        <div className="tabla-toolbar">
          <div className="tabla-busqueda">
            <Search size={16} />
            <input
              type="text"
              placeholder="Buscar por factura, cliente o motivo..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPagina(1);
              }}
            />
          </div>

          <select
            className="select-filtro"
            value={filtroMotivo}
            onChange={(e) => {
              setFiltroMotivo(e.target.value);
              setPagina(1);
            }}
          >
            <option value="todos">Todos los motivos</option>
            {MOTIVOS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {cargando ? (
          <p className="texto-vacio">Cargando...</p>
        ) : devolucionesFiltradas.length === 0 ? (
          <p className="texto-vacio">
            {busqueda || filtroMotivo !== "todos"
              ? "No se encontraron devoluciones con esos filtros"
              : "No hay devoluciones registradas aún."}
          </p>
        ) : (
          <>
            <div className="resumen-devoluciones">
              <span>
                <strong>{devolucionesFiltradas.length}</strong> devolución
                {devolucionesFiltradas.length !== 1 ? "es" : ""}
              </span>
              <span className="resumen-monto">
                Total: <strong>{formatoMoneda(montoTotal)}</strong>
              </span>
            </div>

            <table className="tabla">
              <thead>
                <tr>
                  <th>Factura</th>
                  <th
                    className="th-ordenable"
                    onClick={() => cambiarOrden("fecha")}
                  >
                    <span className="th-contenido">
                      Fecha {iconoOrden("fecha")}
                    </span>
                  </th>
                  <th>Cliente</th>
                  <th>Motivo</th>
                  <th style={{ width: "100px" }}>Items</th>
                  <th
                    className="th-ordenable"
                    onClick={() => cambiarOrden("monto")}
                  >
                    <span className="th-contenido">
                      Monto {iconoOrden("monto")}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {devolucionesPagina.map((dev) => (
                  <tr key={dev.id}>
                    <td>
                      <div className="celda-con-icono">
                        <div className="celda-icono">
                          <Receipt size={16} />
                        </div>
                        <strong>{dev.numero_factura}</strong>
                      </div>
                    </td>
                    <td className="texto-muted">{formatoFecha(dev.fecha)}</td>
                    <td>{dev.cliente_nombre || "Consumidor final"}</td>
                    <td>
                      <span className="badge-motivo">{dev.motivo}</span>
                    </td>
                    <td>
                      <span className="badge-productos">
                        <RotateCcw size={14} />
                        {dev.items_count}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: "#dc2626" }}>
                        - {formatoMoneda(dev.monto)}
                      </strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPaginas > 1 && (
              <div className="paginacion">
                <span className="paginacion-info">
                  Mostrando {(paginaActual - 1) * POR_PAGINA + 1}–
                  {Math.min(paginaActual * POR_PAGINA, devolucionesFiltradas.length)} de{" "}
                  {devolucionesFiltradas.length}
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

      {/* Modal de crear devolución */}
      <ModalDevolucion
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        onCreada={() => {
          setModalAbierto(false);
          cargarDevoluciones();
        }}
      />
    </Layout>
  );
}