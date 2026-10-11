import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, cargando } = useAuth();

  if (cargando) {
    return <div style={{ padding: "40px" }}>Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}