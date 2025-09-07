import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, TrendingUp, DollarSign } from "lucide-react";
import TopNavigation from "@/components/TopNavigation";

const Reportes = () => {
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [reporteGenerado, setReporteGenerado] = useState(false);
  const { toast } = useToast();

  const generarReporte = () => {
    if (!fechaInicio || !fechaFin) {
      toast({
        title: "Error",
        description: "Por favor seleccione las fechas de inicio y fin",
        variant: "destructive"
      });
      return;
    }

    setReporteGenerado(true);
    toast({
      title: "Reporte generado",
      description: "El reporte de ingresos ha sido generado exitosamente"
    });
  };

  // Datos de muestra para el reporte
  const reporteIngresos = [
    {
      fecha: "8/22/2025",
      cliente: "Jonathan Jones",
      membresia: "Mensual",
      metodo: "Tarjeta",
      monto: 20000
    },
    {
      fecha: "8/22/2025",
      cliente: "Diego Rodríguez",
      membresia: "Mensual",
      metodo: "Efectivo",
      monto: 20000
    },
    {
      fecha: "8/22/2025",
      cliente: "Roberto Carranza",
      membresia: "Familiar",
      metodo: "Sinpe",
      monto: 19000
    }
  ];

  const totalIngresos = reporteIngresos.reduce((sum, item) => sum + item.monto, 0);
  const ingresosTarjeta = reporteIngresos.filter(r => r.metodo === "Tarjeta").reduce((sum, item) => sum + item.monto, 0);
  const ingresosEfectivo = reporteIngresos.filter(r => r.metodo === "Efectivo").reduce((sum, item) => sum + item.monto, 0);
  const ingresosSinpe = reporteIngresos.filter(r => r.metodo === "Sinpe").reduce((sum, item) => sum + item.monto, 0);

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />
      <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Reporte de Ingresos</h1>
          <p className="text-muted-foreground">Generar reportes económicos por rango de fechas</p>
        </div>

        {/* Formulario de generación de reporte */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Generar Reporte
            </CardTitle>
            <CardDescription>Seleccione el rango de fechas para el reporte</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="fecha-inicio">Fecha de Inicio</Label>
                <Input
                  id="fecha-inicio"
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="fecha-fin">Fecha de Fin</Label>
                <Input
                  id="fecha-fin"
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                />
              </div>
              <Button onClick={generarReporte} className="bg-blue-600 hover:bg-blue-700">
                Generar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Resultados del reporte */}
        {reporteGenerado && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Resultados del Reporte
              </CardTitle>
              <CardDescription>
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-2xl font-bold text-primary">
                    **Total de Ingresos:** ₡{totalIngresos.toLocaleString()}
                  </span>
                  <div className="flex gap-4 text-sm">
                    <span>**Tarjeta:** ₡{ingresosTarjeta.toLocaleString()}</span>
                    <span>**Efectivo:** ₡{ingresosEfectivo.toLocaleString()}</span>
                    <span>**Sinpe:** ₡{ingresosSinpe.toLocaleString()}</span>
                  </div>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-4 font-semibold">FECHA</th>
                      <th className="text-left p-4 font-semibold">CLIENTE</th>
                      <th className="text-left p-4 font-semibold">MEMBRESÍA</th>
                      <th className="text-left p-4 font-semibold">MÉTODO DE PAGO</th>
                      <th className="text-right p-4 font-semibold">MONTO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporteIngresos.map((item, index) => (
                      <tr key={index} className="border-b hover:bg-muted/25">
                        <td className="p-4">{item.fecha}</td>
                        <td className="p-4 font-medium">{item.cliente}</td>
                        <td className="p-4">{item.membresia}</td>
                        <td className="p-4">
                          <span className={`inline-block px-2 py-1 rounded text-xs ${
                            item.metodo === 'Efectivo' ? 'bg-green-100 text-green-800' :
                            item.metodo === 'Tarjeta' ? 'bg-blue-100 text-blue-800' :
                            'bg-purple-100 text-purple-800'
                          }`}>
                            {item.metodo}
                          </span>
                        </td>
                        <td className="p-4 text-right font-semibold">₡{item.monto.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Resumen por Método de Pago
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-green-50 rounded border">
                    <p className="text-sm text-muted-foreground">Efectivo</p>
                    <p className="text-lg font-bold text-green-700">₡{ingresosEfectivo.toLocaleString()}</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded border">
                    <p className="text-sm text-muted-foreground">Tarjeta</p>
                    <p className="text-lg font-bold text-blue-700">₡{ingresosTarjeta.toLocaleString()}</p>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded border">
                    <p className="text-sm text-muted-foreground">Sinpe</p>
                    <p className="text-lg font-bold text-purple-700">₡{ingresosSinpe.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </div>
  );
};

export default Reportes;