import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Receipt,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Banknote,
  CreditCard,
  ArrowLeftRight,
} from "lucide-react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";
import { useToast } from "../hooks/useToast";
import type { Venta } from "../types";

type OrdenCampo = "numero_factura" | "fecha" | "total";
type OrdenDir = "asc" | "desc";
type FiltroMetodo = "todos" | "efectivo" | "tarjeta" | "transferencia";
type FiltroFecha = "hoy" | "semana" | "mes" | "todo";

const POR_PAGINA = 15;

export default function Ventas() {
  const toast = useToast();
  const navigate = useNavigate();

  const [ventas, setVentas] = useState<Venta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroMetodo, setFiltroMetodo] = useState<FiltroMetodo>("todos");
  const [filtroFecha, setFiltroFecha] = useState<FiltroFecha>("todo");
  const [ordenCampo, setOrdenCampo] = useState<OrdenCampo>("fecha");
  const [ordenDir, setOrdenDir] = useState<OrdenDir>("desc");
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    cargarVentas();
  }, []);

  async function cargarVentas() {
    setCargando(true);
    const { data, error } = await supabase
      .from("ventas")
      .select("*")
      .order("fecha", { ascending: false });

    if (error) {
      toast.error("Error al cargar ventas: " + error.message);
    } else {
      setVentas(data || []);
    }
    setCargando(false);
  }

  // ==================== FILTRADO ====================
  const ventasFiltradas = useMemo(() => {
    let resultado = [...ventas];

    // Búsqueda
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      resultado = resultado.filter(
        (v) =>
          v.numero_factura.toLowerCase().includes(q) ||
          (v.cliente_nombre || "").toLowerCase().includes(q)
      );
    }

    // Filtro método
    if (filtroMetodo !== "todos") {
      resultado = resultado.filter((v) => v.metodo_pago === filtroMetodo);
    }

    // Filtro fecha
    if (filtroFecha !== "todo") {
      const ahora = new Date();
      const limite = new Date();
      if (filtroFecha === "hoy") {
        limite.setHours(0, 0, 0, 0);
      } else if (filtroFecha === "semana") {
        limite.setDate(ahora.getDate() - 7);
      } else if (filtroFecha === "mes") {
        limite.setDate(ahora.getDate() - 30);
      }
      resultado = resultado.filter((v) => new Date(v.fecha) >= limite);
    }

    // Orden
    resultado.sort((a, b) => {
      const av = (a[ordenCampo] ?? "") as any;
      const bv = (b[ordenCampo] ?? "") as any;
      if (av < bv) return ordenDir === "asc" ? -1 : 1;
      if (av > bv) return ordenDir === "asc" ? 1 : -1;
      return 0;
    });

    return resultado;
  }, [ventas, busqueda, filtroMetodo, filtroFecha, ordenCampo, ordenDir]);

  const totalPaginas = Math.max(1, Math.ceil(ventasFiltradas.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const ventasPagina = ventasFiltradas.slice(
    (paginaActual - 1) * POR_PAGINA,
    paginaActual * POR_PAGINA
  );

  // ==================== TOTALES DEL FILTRO ====================
  const totalFiltrado = ventasFiltradas.reduce((acc, v) => acc + Number(v.total), 0);

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
          <h2>Historial de Ventas</h2>
          <p>Consulta todas las facturas emitidas</p>
        </div>
        <div className="ventas-resumen">
          <span className="ventas-resumen-label">
            {ventasFiltradas.length} factura{ventasFiltradas.length !== 1 ? "s" : ""}
          </span>
          <span className="ventas-resumen-total">
            {formatoMoneda(totalFiltrado)}
          </span>
        </div>
      </div>

      <div className="card-panel">
        <div className="tabla-toolbar">
          <div className="tabla-busqueda">
            <Search size={16} />
            <input
              type="text"
              placeholder="Buscar por factura o cliente..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPagina(1);
              }}
            />
          </div>

          <select
            className="select-filtro"
            value={filtroFecha}
            onChange={(e) => {
              setFiltroFecha(e.target.value as any);
              setPagina(1);
            }}
          >
            <option value="todo">Todo el tiempo</option>
            <option value="hoy">Hoy</option>
            <option value="semana">Últimos 7 días</option>
            <option value="mes">Últimos 30 días</option>
          </select>

          <select
            className="select-filtro"
            value={filtroMetodo}
            onChange={(e) => {
              setFiltroMetodo(e.target.value as any);
              setPagina(1);
            }}
          >
            <option value="todos">Todos los métodos</option>
            <option value="efectivo">💵 Efectivo</option>
            <option value="tarjeta">💳 Tarjeta</option>
            <option value="transferencia">🔄 Transferencia</option>
          </select>
        </div>

        {cargando ? (
          <p className="texto-vacio">Cargando...</p>
        ) : ventasFiltradas.length === 0 ? (
          <p className="texto-vacio">
            {busqueda || filtroMetodo !== "todos" || filtroFecha !== "todo"
              ? "No se encontraron ventas con esos filtros"
              : "No hay ventas registradas aún. Realiza la primera desde el POS."}
          </p>
        ) : (
          <>
            <table className="tabla">
              <thead>
                <tr>
                  <th
                    className="th-ordenable"
                    onClick={() => cambiarOrden("numero_factura")}
                  >
                    <span className="th-contenido">
                      Factura {iconoOrden("numero_factura")}
                    </span>
                  </th>
                  <th
                    className="th-ordenable"
                    onClick={() => cambiarOrden("fecha")}
                  >
                    <span className="th-contenido">
                      Fecha {iconoOrden("fecha")}
                    </span>
                  </th>
                  <th>Cliente</th>
                  <th>Método</th>
                  <th
                    className="th-ordenable"
                    onClick={() => cambiarOrden("total")}
                  >
                    <span className="th-contenido">
                      Total {iconoOrden("total")}
                    </span>
                  </th>
                  <th style={{ width: "100px" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ventasPagina.map((venta) => (
                  <tr key={venta.id}>
                    <td>
                      <div className="celda-con-icono">
                        <div className="celda-icono">
                          <Receipt size={16} />
                        </div>
                        <strong>{venta.numero_factura}</strong>
                      </div>
                    </td>
                    <td className="texto-muted">{formatoFecha(venta.fecha)}</td>
                    <td>{venta.cliente_nombre || "Consumidor final"}</td>
                    <td>
                      <span className={"badge-metodo badge-metodo-" + venta.metodo_pago}>
                        {iconoMetodo(venta.metodo_pago)}
                        {venta.metodo_pago}
                      </span>
                    </td>
                    <td>
                      <strong>{formatoMoneda(venta.total)}</strong>
                    </td>
                    <td>
                      <div className="acciones-tabla">
                        <button
                          className="btn-icono"
                          onClick={() => navigate(`/ventas/${venta.id}`)}
                          title="Ver detalle"
                        >
                          <Eye size={16} />
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
                  {Math.min(paginaActual * POR_PAGINA, ventasFiltradas.length)} de{" "}
                  {ventasFiltradas.length}
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
    </Layout>
  );
}