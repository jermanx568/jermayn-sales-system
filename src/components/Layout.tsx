import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="layout">
      <Sidebar />
      <div className="layout-main">
        <Header />
        <main className="layout-contenido">{children}</main>
      </div>
    </div>
  );
}