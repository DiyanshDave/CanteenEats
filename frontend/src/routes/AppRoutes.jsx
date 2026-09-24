import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Login from "../pages/Login.jsx";
import Register from "../pages/Register.jsx";
import StudentDashboard from "../pages/StudentDashboard.jsx";
import StaffDashboard from "../pages/StaffDashboard.jsx";
import AdminDashboard from "../pages/AdminDashboard.jsx";
import AdminMenuPage from "../pages/AdminMenuPage.jsx";
import AdminInventoryPage from "../pages/AdminInventoryPage.jsx";
import AdminAnalyticsPage from "../pages/AdminAnalyticsPage.jsx";
import AdminStaffPage from "../pages/AdminStaffPage.jsx";
import Cart from "../pages/Cart.jsx";
import OrderConfirmation from "../pages/OrderConfirmation.jsx";
import OrderTracking from "../pages/OrderTracking.jsx";

// Maps each role to its home route, used for redirects
const ROLE_HOME = {
  STUDENT: "/student",
  STAFF: "/staff",
  ADMIN: "/admin",
};

// Reusable role-based route guard
const ProtectedRoute = ({ allowedRoles, children }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    const fallback = ROLE_HOME[user?.role] || "/login";
    return <Navigate to={fallback} replace />;
  }

  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/student"
        element={
          <ProtectedRoute allowedRoles={["STUDENT"]}>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/cart"
        element={
          <ProtectedRoute allowedRoles={["STUDENT"]}>
            <Cart />
          </ProtectedRoute>
        }
      />

      <Route
        path="/order-confirmation/:id"
        element={
          <ProtectedRoute allowedRoles={["STUDENT"]}>
            <OrderConfirmation />
          </ProtectedRoute>
        }
      />

      <Route
        path="/orders/:id"
        element={
          <ProtectedRoute allowedRoles={["STUDENT"]}>
            <OrderTracking />
          </ProtectedRoute>
        }
      />

      <Route
        path="/staff"
        element={
          <ProtectedRoute allowedRoles={["STAFF", "ADMIN"]}>
            <StaffDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/menu"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminMenuPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/inventory"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminInventoryPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/analytics"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminAnalyticsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/staff"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminStaffPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default AppRoutes;
