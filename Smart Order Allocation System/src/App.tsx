import { useState, useEffect } from "react";
import { getSession } from "./lib/auth";
import { getHash, navigate } from "./lib/router";
import type { Route } from "./lib/router";
import type { Role } from "./lib/types";

import Login from "./pages/Login";
import Layout from "./components/Layout";
import NewOrder from "./pages/customer/NewOrder";
import OrderHistory from "./pages/customer/OrderHistory";
import Dashboard from "./pages/admin/Dashboard";
import ProductManagement from "./pages/admin/ProductManagement";
import BranchManagement from "./pages/admin/BranchManagement";
import UserManagement from "./pages/admin/UserManagement";
import OrderManagement from "./pages/admin/OrderManagement";
import MessageClassifier from "./pages/admin/MessageClassifier";

const ADMIN_ROUTES: Route[] = [
  "/admin",
  "/admin/products",
  "/admin/branches",
  "/admin/users",
  "/admin/orders",
  "/admin/classifier",
];
const CUSTOMER_ROUTES: Route[] = ["/orders/new", "/orders", "/orders/status"];

export default function App() {
  const [route, setRoute] = useState<Route>(getHash());

  useEffect(() => {
    function onHashChange() {
      setRoute(getHash());
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Auth guard
  useEffect(() => {
    const session = getSession();
    if (!session) {
      if (route !== "/login") navigate("/login");
      return;
    }
    const userRole = session.user.role;
    if (userRole === "customer" && ADMIN_ROUTES.includes(route)) {
      navigate("/orders/new");
    }
    if (userRole === "admin" && CUSTOMER_ROUTES.includes(route)) {
      navigate("/admin");
    }
  }, [route]);

  function handleLogin(_loggedInRole: Role) {
    setRoute(getHash());
  }

  // Not authenticated
  const session = getSession();
  if (!session || route === "/login") {
    return <Login onLogin={handleLogin} />;
  }

  const userName = session.user.name;
  const userRole = session.user.role;

  function renderPage() {
    switch (route) {
      // Customer
      case "/orders/new": return <NewOrder />;
      case "/orders": return <OrderHistory />;
      // Admin
      case "/admin": return <Dashboard />;
      case "/admin/products": return <ProductManagement />;
      case "/admin/branches": return <BranchManagement />;
      case "/admin/users": return <UserManagement />;
      case "/admin/orders": return <OrderManagement />;
      case "/admin/classifier": return <MessageClassifier />;
      default:
        return userRole === "admin" ? <Dashboard /> : <NewOrder />;
    }
  }

  return (
    <Layout currentRoute={route} role={userRole} userName={userName}>
      {renderPage()}
    </Layout>
  );
}
