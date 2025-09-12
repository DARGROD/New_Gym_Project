import { useState } from "react";
import { supabase } from "../integrations/supabase/client";
import { useToast } from "../hooks/use-toast";
import TopNavigation from "../components/TopNavigation";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

type PaymentBreakdown = {
  cash: number;
  card: number;
  transfer: number;
  sinpe: number;
};

const Reportes = () => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reportData, setReportData] = useState<any[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentBreakdown>({
    cash: 0,
    card: 0,
    transfer: 0,
    sinpe: 0,
  });
  const { toast } = useToast();

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Error",
        description: "Por favor, selecciona una fecha de inicio y una de fin.",
        variant: "destructive",
      });
      return;
    }

    if (parseISO(startDate) > parseISO(endDate)) {
      toast({
        title: "Error de Fechas",
        description: "La fecha de inicio no puede ser posterior a la fecha de fin.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: memberships, error } = await supabase
        .from("memberships")
        .select(`
          created_at,
          payments,
          membership_plans (
            name,
            price
          ),
          clients (
            first_name,
            last_name
          )
        `)
        .gte("created_at", `${startDate}T00:00:00.000Z`)
        .lte("created_at", `${endDate}T23:59:59.999Z`);

      if (error) throw error;

      if (!memberships || memberships.length === 0) {
        setReportData([]);
        setTotalRevenue(0);
        setPaymentBreakdown({ cash: 0, card: 0, transfer: 0, sinpe: 0 });
        toast({
          title: "Sin resultados",
          description: "No se encontraron pagos en el rango de fechas seleccionado.",
        });
        return;
      }

      let total = 0;
      const breakdown: PaymentBreakdown = { cash: 0, card: 0, transfer: 0, sinpe: 0 };

      const formattedData = memberships.map((item: any) => {
        const price = item.membership_plans?.price || 0;
        const paymentType = item.payments || "N/A";
        total += price;
        if (paymentType in breakdown) {
          breakdown[paymentType as keyof PaymentBreakdown] += price;
        }
        return {
          date: format(parseISO(item.created_at), "PPP", { locale: es }),
          clientName: `${item.clients.first_name} ${item.clients.last_name}`,
          membershipPlan: item.membership_plans?.name,
          price,
          payment: paymentType,
        };
      });

      setReportData(formattedData);
      setTotalRevenue(total);
      setPaymentBreakdown(breakdown);

      toast({
        title: "Reporte Generado",
        description: "El reporte de ingresos se ha generado exitosamente.",
        className: "bg-green-500 text-white",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error al generar reporte:", error);
      toast({
        title: "Error al generar reporte",
        description: "Hubo un problema al cargar los datos.",
        variant: "destructive",
      });
    }
  };

  const handleExportCSV = () => {
    const headers = ["Fecha", "Cliente", "Membresia", "Metodo de Pago", "Monto"];
    const csvContent = [
      headers.join(","),
      ...reportData.map(item =>
        `${item.date},"${item.clientName}",${item.membershipPlan},${item.payment},${item.price}`
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `reporte_ingresos_${startDate}_${endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPaymentBadgeColor = (method: string) => {
    switch (method) {
      case 'Efectivo':
      case 'cash':
        return 'bg-green-100 text-green-800';
      case 'Tarjeta':
      case 'card':
        return 'bg-blue-100 text-blue-800';
      case 'Transferencia':
      case 'transfer':
        return 'bg-yellow-100 text-yellow-800';
      case 'SINPE Móvil':
      case 'sinpe':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatNumberWithCommas = (number: number) => {
    return number.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-primary">Reporte de Ingresos</h1>

        {/* Selector de Fechas */}
        <Card className="mb-6 bg-white">
          <CardHeader>
            <CardTitle>Generar Reporte por Fecha</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="flex-1">
                <Label htmlFor="start-date">Fecha de Inicio</Label>
                <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="flex-1">
                <Label htmlFor="end-date">Fecha de Fin</Label>
                <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <Button onClick={handleGenerateReport} className="mt-6 md:mt-4 bg-primary text-primary-foreground">
                Generar Reporte
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Resultados del reporte */}
        {reportData.length > 0 && (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6">
              <Card>
                <CardHeader><CardTitle>Ingresos Totales</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">₡{formatNumberWithCommas(totalRevenue)}</div></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Efectivo</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">₡{formatNumberWithCommas(paymentBreakdown.cash)}</div></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Tarjeta</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">₡{formatNumberWithCommas(paymentBreakdown.card)}</div></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Transferencias</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">₡{formatNumberWithCommas(paymentBreakdown.transfer)}</div></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>SINPE Móvil</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">₡{formatNumberWithCommas(paymentBreakdown.sinpe)}</div></CardContent>
              </Card>
            </div>

            {/* Tabla */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Detalle de Ingresos</CardTitle>
                <Button onClick={handleExportCSV} className="bg-green-500 text-white">Exportar a CSV</Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Membresía</TableHead>
                      <TableHead>Método de Pago</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="w-1/6">{item.date}</TableCell>
                        <TableCell className="w-1/5 font-medium">{item.clientName}</TableCell>
                        <TableCell className="w-1/6">{item.membershipPlan}</TableCell>
                        <TableCell className="w-1/6">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getPaymentBadgeColor(item.payment)}`}>
                            {item.payment}
                          </span>
                        </TableCell>
                        <TableCell className="w-1/5 text-right font-semibold">₡{formatNumberWithCommas(item.price)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default Reportes;
