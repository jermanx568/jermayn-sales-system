import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./hooks/useToast";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Categorias from "./pages/Categorias";
import Productos from "./pages/Productos";
import Lotes from "./pages/Lotes";
import POS from "./pages/Pos";
import Ventas from "./pages/Ventas";
import DetalleVenta from "./pages/Detalleventa";
import Devoluciones from "./pages/Devoluciones";
import Ofertas from "./pages/Ofertas";
import Combos from "./pages/Combos";
import ProtectedRoute from "./components/ProtectedRoute";
import "./App.css";

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* ========== PÚBLICAS ========== */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* ========== PROTEGIDAS ========== */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/categorias"
              element={
                <ProtectedRoute>
                  <Categorias />
                </ProtectedRoute>
              }
            />

            <Route
              path="/productos"
              element={
                <ProtectedRoute>
                  <Productos />
                </ProtectedRoute>
              }
            />

            <Route
              path="/lotes"
              element={
                <ProtectedRoute>
                  <Lotes />
                </ProtectedRoute>
              }
            />

            <Route
              path="/pos"
              element={
                <ProtectedRoute>
                  <POS />
                </ProtectedRoute>
              }
            />

            <Route
              path="/ventas"
              element={
                <ProtectedRoute>
                  <Ventas />
                </ProtectedRoute>
              }
            />

            <Route
              path="/ventas/:id"
              element={
                <ProtectedRoute>
                  <DetalleVenta />
                </ProtectedRoute>
              }
            />

            <Route
              path="/devoluciones"
              element={
                <ProtectedRoute>
                  <Devoluciones />
                </ProtectedRoute>
              }
            />

            <Route
              path="/ofertas"
              element={
                <ProtectedRoute>
                  <Ofertas />
                </ProtectedRoute>
              }
            />

            <Route
              path="/combos"
              element={
                <ProtectedRoute>
                  <Combos />
                </ProtectedRoute>
              }
            />

            {/* ========== FALLBACK ========== */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}