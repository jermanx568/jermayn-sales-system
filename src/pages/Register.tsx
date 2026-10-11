import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setCargando(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre },
      },
    });

    setCargando(false);

    if (error) {
      setError(error.message);
      return;
    }

    alert("Cuenta creada. Revisa tu correo para confirmar.");
    navigate("/login");
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Crear cuenta</h1>
        <p className="auth-sub">Sistema POS de Ventas</p>

        <form onSubmit={handleSubmit}>
          <div className="campo">
            <label>Nombre completo</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              placeholder="Tu nombre"
            />
          </div>

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
              minLength={6}
              placeholder="Minimo 6 caracteres"
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" disabled={cargando} className="btn-primario">
            {cargando ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        <p className="auth-footer">
          Ya tienes cuenta? <Link to="/login">Inicia sesion</Link>
        </p>
      </div>
    </div>
  );
}