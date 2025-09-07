import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import TopNavigation from "@/components/TopNavigation";

const Pagos = () => {
  const pagosMuestra = [
    { id: "1", cliente: "Juan Pérez", monto: 20000, metodo: "Efectivo", fecha: "2024-08-29" },
    { id: "2", cliente: "María González", monto: 19000, metodo: "Tarjeta", fecha: "2024-08-28" }
  ];

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />
      <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-primary mb-8">Historial de Pagos</h1>
        <Card>
          <CardHeader>
            <CardTitle>Pagos Registrados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pagosMuestra.map((pago) => (
                <div key={pago.id} className="border rounded p-4 flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{pago.cliente}</p>
                    <p className="text-sm text-muted-foreground">{pago.fecha}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">₡{pago.monto.toLocaleString()}</p>
                    <Badge variant="outline">{pago.metodo}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
};

export default Pagos;