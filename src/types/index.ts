export interface Categoria {
  id: string;
  nombre: string;
  descripcion: string | null;
  codigo: string | null;
  color: string;
  icono: string;
  activa: boolean;
  orden: number;
  created_at: string;
  updated_at: string;
}

// Para cuando consultemos categoria con conteo de productos
export interface CategoriaConConteo extends Categoria {
  productos_count?: number;
}

export interface Producto {
  id: string;
  codigo: string;
  codigo_barras: string | null;
  nombre: string;
  descripcion: string | null;
  precio_compra: number;
  precio_venta: number;
  categoria_id: string | null;
  stock_minimo: number;
  unidad_medida: string;
  ubicacion: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

// Producto con datos de la categoria y stock calculado
export interface ProductoConDetalles extends Producto {
  categoria_nombre?: string;
  categoria_color?: string;
  stock_total?: number;
}
export interface Lote {
  id: string;
  producto_id: string;
  codigo_lote: string | null;
  cantidad_inicial: number;
  cantidad_actual: number;
  fecha_entrada: string;
  fecha_vencimiento: string | null;
  precio_compra_unitario: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

// Lote con datos del producto para mostrar en tabla
export interface LoteConDetalles extends Lote {
  producto_nombre?: string;
  producto_codigo?: string;
  dias_para_vencer?: number | null;
  estado_vencimiento?: "vencido" | "critico" | "proximo" | "ok" | "sin-vencimiento";
}

// Tipo de estado de vencimiento con colores
export type EstadoVencimiento = "vencido" | "critico" | "proximo" | "ok" | "sin-vencimiento";
export interface ItemCarrito {
  producto_id: string;
  codigo: string;
  nombre: string;
  precio_unitario: number;
  cantidad: number;
  stock_disponible: number;
}

export type MetodoPago = "efectivo" | "tarjeta" | "transferencia";

export interface ItemVenta {
  venta_id: string;
  producto_id: string;
  lote_id: string | null;
  cantidad: number;
  precio_unitario: number;
  descuento_linea: number;
  subtotal: number;
}

export interface Ticket {
  numero_factura: string;
  cliente_nombre: string;
  items: ItemCarrito[];
  subtotal: number;
  descuento: number;
  iva_porcentaje: number;
  iva_monto: number;
  total: number;
  metodo_pago: MetodoPago;
  monto_recibido: number;
  cambio: number;
  fecha: string;
}
export interface Venta {
  id: string;
  numero_factura: string;
  usuario_id: string | null;
  cliente_nombre: string | null;
  subtotal: number;
  descuento: number;
  total: number;
  iva_porcentaje: number;
  iva_monto: number;
  metodo_pago: string;
  monto_recibido: number;
  cambio: number;
  estado: string;
  fecha: string;
}

export interface DetalleVentaConTrazabilidad {
  id: string;
  venta_id: string;
  producto_id: string;
  lote_id: string | null;
  cantidad: number;
  precio_unitario: number;
  descuento_linea: number;
  subtotal: number;
  // Datos del producto
  producto_codigo: string;
  producto_nombre: string;
  // Datos del lote (trazabilidad)
  lote_codigo: string | null;
  lote_fecha_entrada: string | null;
  lote_fecha_vencimiento: string | null;
  costo_unitario_lote: number;
  // Cálculos
  margen_unitario: number;
  margen_total: number;
}

export interface VentaConDetalles extends Venta {
  detalles: DetalleVentaConTrazabilidad[];
  usuario_email?: string;
}
export interface Devolucion {
  id: string;
  venta_id: string;
  motivo: string;
  monto: number;
  usuario_id: string | null;
  fecha: string;
}

export interface DetalleDevolucion {
  id: string;
  devolucion_id: string;
  producto_id: string;
  lote_id: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  reingresado: boolean;
}

// Para el modal de crear devolucion
export interface ItemDevolucion {
  detalle_venta_id: string;
  producto_id: string;
  lote_id: string | null;
  producto_codigo: string;
  producto_nombre: string;
  cantidad_vendida: number;
  cantidad_disponible: number; // cantidad - ya devuelta antes
  cantidad_a_devolver: number;
  precio_unitario: number;
  seleccionado: boolean;
}

export interface DevolucionConDetalles extends Devolucion {
  numero_factura: string;
  cliente_nombre: string | null;
  items_count: number;
}
export type TipoOferta =
  | "porcentaje_categoria"
  | "porcentaje_producto"
  | "2x1"
  | "cantidad"
  | "precio_fijo";

export interface Oferta {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo: TipoOferta;
  valor: number;
  condicion: string | null;
  categoria_id: string | null;
  producto_id: string | null;
  cantidad_minima: number;
  cantidad_gratis: number;
  precio_fijo: number | null;
  prioridad: number;
  activa: boolean;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  created_at: string;
  updated_at: string;
}

export interface OfertaConDetalles extends Oferta {
  categoria_nombre?: string | null;
  categoria_color?: string | null;
  producto_nombre?: string | null;
  producto_codigo?: string | null;
  estado_vigencia?: "activa" | "programada" | "expirada" | "sin-fecha";
}
export interface Combo {
  id: string;
  nombre: string;
  descripcion: string | null;
  codigo: string | null;
  precio_combo: number;
  precio_original: number;
  imagen_color: string;
  prioridad: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ComboProducto {
  id: string;
  combo_id: string;
  producto_id: string;
  cantidad: number;
}

export interface ComboProductoConDetalles extends ComboProducto {
  producto_codigo: string;
  producto_nombre: string;
  producto_precio: number;
  producto_stock: number;
  subtotal: number;
}

export interface ComboConDetalles extends Combo {
  productos: ComboProductoConDetalles[];
  productos_count: number;
  ahorro: number;
  porcentaje_ahorro: number;
}

// Para el formulario de creación
export interface ItemComboForm {
  producto_id: string;
  cantidad: number;
}
export interface DashboardStats {
  ventas_hoy: number;
  facturas_hoy: number;
  ventas_semana: number;
  facturas_semana: number;
  ventas_mes: number;
  facturas_mes: number;
  ticket_promedio: number;
  productos_bajo_stock: number;
  lotes_por_vencer: number;
}

export interface VentaGrafica {
  fecha: string;
  dia_corto: string;
  total: number;
  facturas: number;
}

export interface TopProducto {
  producto_id: string;
  nombre: string;
  codigo: string;
  cantidad_vendida: number;
  ingreso_total: number;
}

export interface ActividadReciente {
  id: string;
  numero_factura: string;
  total: number;
  metodo_pago: string;
  fecha: string;
  hace: string;
}