import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setCargando(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setCargando(false);

    if (error) {
      setError(error.message);
      return;
    }

    navigate("/dashboard");
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Iniciar sesion</h1>
        <p className="auth-sub">Sistema POS de Ventas</p>

        <form onSubmit={handleSubmit}>
          <div className="campo">
            <label>Correo electronico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@correo.com"
            />
          </div>

          <div className="campo">
            <label>Contrasena</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" disabled={cargando} className="btn-primario">
            {cargando ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <p className="auth-footer">
          No tienes cuenta? <Link to="/register">Registrate</Link>
        </p>
      </div>
    </div>
  );
}