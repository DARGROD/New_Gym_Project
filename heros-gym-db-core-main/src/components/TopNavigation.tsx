import { Button } from "@/components/ui/button";
import { Home, Users, CreditCard, FileText, Calendar, AlertTriangle, DollarSign, LogIn } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const TopNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navigationItems = [
    { label: "Dashboard", path: "/", icon: Home },
    { label: "Asistencia", path: "/asistencia", icon: LogIn },
    { label: "Clientes", path: "/clientes", icon: Users },
    { label: "Membresías", path: "/membresias", icon: CreditCard },
    { label: "Reportes", path: "/reportes", icon: FileText },
    { label: "Vencimientos", path: "/vencimientos", icon: AlertTriangle },
   // { label: "Pagos", path: "/pagos", icon: DollarSign },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-1">
            <h1 className="text-xl font-bold text-primary mr-8">Hero's Gym</h1>
            
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.path}
                  variant={isActive(item.path) ? "default" : "ghost"}
                  size="sm"
                  onClick={() => navigate(item.path)}
                  className="flex items-center gap-2"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default TopNavigation;