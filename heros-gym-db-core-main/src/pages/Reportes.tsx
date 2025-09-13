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

// ========================= Helpers de fecha (LOCAL, sin TZ) =========================

// "YYYY-MM-DD" -> Date local (00:00 en tu zona local)
const dateFromISODateOnlyLocal = (s?: string) => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(y, mo, d);
};
// Suma días a un Date (local)
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
// Etiqueta bonita en español para método de pago
const paymentLabel = (method?: string) => {
  if (!method) return "N/A";
  if (method === "cash" || method === "Efectivo") return "Efectivo";
  if (method === "card" || method === "Tarjeta") return "Tarjeta";
  if (method === "transfer" || method === "Transferencia") return "Transferencia";
  if (method === "sinpe" || method === "SINPE Movil") return "SINPE Movil";
  return method;
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

    const startLocal = dateFromISODateOnlyLocal(startDate);
    const endLocal = dateFromISODateOnlyLocal(endDate);
    if (!startLocal || !endLocal) {
      toast({
        title: "Error de Fechas",
        description: "Formato de fecha inválido.",
        variant: "destructive",
      });
      return;
    }
    if (startLocal.getTime() > endLocal.getTime()) {
      toast({
        title: "Error de Fechas",
        description: "La fecha de inicio no puede ser posterior a la fecha de fin.",
        variant: "destructive",
      });
      return;
    }

    // Filtro por día LOCAL: [inicio 00:00 local, fin+1 00:00 local) => a UTC
    const startUTC = startLocal.toISOString();
    const endExclusiveUTC = addDays(endLocal, 1).toISOString();

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
        .gte("created_at", startUTC)
        .lt("created_at", endExclusiveUTC);

      if (error) throw error;

      if (!memberships || memberships.length === 0) {
        setReportData([]);
        setTotalRevenue(0);
        setPaymentBreakdown({ cash: 0, card: 0, transfer: 0, sinpe: 0 });
        toast({
          title: "Sin resultados",
          description: "No se encontraron membresías creadas en el rango seleccionado.",
        });
        return;
      }

      let total = 0;
      const breakdown: PaymentBreakdown = { cash: 0, card: 0, transfer: 0, sinpe: 0 };

      const formattedData = memberships.map((item: any) => {
        const priceNum = Number(item?.membership_plans?.price ?? 0);
        const method = item?.payments ?? "N/A";
        const label = paymentLabel(method);

        total += priceNum;
        if (method in breakdown) {
          breakdown[method as keyof PaymentBreakdown] += priceNum;
        }

        return {
          date: format(parseISO(item.created_at), "PPP", { locale: es }), // visual local
          clientName: `${item.clients?.first_name ?? ""} ${item.clients?.last_name ?? ""}`.trim(),
          membershipPlan: item.membership_plans?.name ?? "N/A",
          price: priceNum,
          payment: label, // usamos etiqueta en español
          rawPayment: method, // guardamos el método crudo por si se requiere
        };
      });

      setReportData(formattedData);
      setTotalRevenue(total);
      setPaymentBreakdown(breakdown);

      toast({
        title: "Reporte Generado",
        description: "El reporte de ingresos se ha generado exitosamente.",
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
    if (reportData.length === 0) return;

    const headers = ["Fecha", "Cliente", "Membresia", "Metodo de Pago", "Monto"];
    const csvRows = [
      headers.join(","),
      ...reportData.map((item) => {
        // Envuelve en comillas y escapa comillas internas
        const q = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
        return [
          q(item.date),
          q(item.clientName),
          q(item.membershipPlan),
          q(item.payment),
          item.price.toFixed(2),
        ].join(",");
      }),
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `reporte_ingresos_${startDate}_${endDate}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPaymentBadgeColor = (method: string) => {
    switch (method) {
      case "Efectivo":
      case "cash":
        return "bg-green-100 text-green-800";
      case "Tarjeta":
      case "card":
        return "bg-blue-100 text-blue-800";
      case "Transferencia":
      case "transfer":
        return "bg-yellow-100 text-yellow-800";
      case "SINPE Movil":
      case "sinpe":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatNumberWithCommas = (number: number) => {
    return number.toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    // Nota: si quieres mostrar colones sin decimales, ajusta las fracciones.
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
                <CardHeader>
                  <CardTitle>Ingresos Totales</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₡{formatNumberWithCommas(totalRevenue)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Efectivo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₡{formatNumberWithCommas(paymentBreakdown.cash)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Tarjeta</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₡{formatNumberWithCommas(paymentBreakdown.card)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Transferencias</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₡{formatNumberWithCommas(paymentBreakdown.transfer)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>SINPE Movil</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₡{formatNumberWithCommas(paymentBreakdown.sinpe)}</div>
                </CardContent>
              </Card>
            </div>

            {/* Tabla */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Detalle de Ingresos</CardTitle>
                <Button onClick={handleExportCSV} className="bg-green-500 text-white">
                  Exportar a CSV
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Membresia</TableHead>
                      <TableHead>Metodo de Pago</TableHead>
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
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getPaymentBadgeColor(
                              item.payment
                            )}`}
                          >
                            {item.payment}
                          </span>
                        </TableCell>
                        <TableCell className="w-1/5 text-right font-semibold">
                          ₡{formatNumberWithCommas(item.price)}
                        </TableCell>
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
