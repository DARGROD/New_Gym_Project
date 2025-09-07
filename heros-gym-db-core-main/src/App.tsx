import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Asistencia from "./pages/Asistencia";
import Clientes from "./pages/Clientes";
import Membresias from "./pages/Membresias";
import Reportes from "./pages/Reportes";
import Vencimientos from "./pages/Vencimientos";
import Pagos from "./pages/Pagos";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/asistencia" element={<Asistencia />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/membresias" element={<Membresias />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/vencimientos" element={<Vencimientos />} />
          <Route path="/pagos" element={<Pagos />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
