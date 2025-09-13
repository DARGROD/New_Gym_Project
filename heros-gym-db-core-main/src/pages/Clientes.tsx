import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Search, CheckCircle, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import TopNavigation from "@/components/TopNavigation";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";

// ========================= Helpers de fecha (LOCAL, sin TZ) =========================

// Convierte "YYYY-MM-DD" -> Date local (00:00 en tu zona local, no UTC)
const dateFromISODateOnlyLocal = (s: string) => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(y, mo, d); // <-- local time
};

// Devuelve "YYYY-MM-DD" (sin TZ) desde Date local
const fmtISODateOnlyLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Trunca Date a 00:00 local
const toDateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Regla de vigencia por fecha (día inclusive): vigente si hoy <= end_date
const isValidByDate = (endDateStr: string) => {
  const end = dateFromISODateOnlyLocal(endDateStr);
  if (!end) return false;
  const today = toDateOnly(new Date());
  return today.getTime() <= end.getTime();
};

// Regla de vencimiento por fecha: vencida si hoy > end_date
const isExpiredByDate = (endDateStr: string) => {
  const end = dateFromISODateOnlyLocal(endDateStr);
  if (!end) return false;
  const today = toDateOnly(new Date());
  return today.getTime() > end.getTime();
};

// Para impresión exacta de la DB (tal cual viene): usamos el string
const printDBDate = (dateStr?: string) => {
  if (!dateStr) return "N/A";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
};

// ========================= Helpers de plan =========================

const normalize = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const addMonthsSameDay = (d: Date, n: number) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
};

/**
 * Calcula end_date según el tipo de plan (por nombre).
 * - Mensual/Familiar: +1 mes exacto (vence mismo día del mes siguiente, inclusive).
 * - Quincenal: +14 días (inclusive).
 * - Semanal: +7 días (inclusive).
 * - Sesión: mismo día (inclusive hasta 23:59:59 local).
 */
const computeEndDateByPlanName = (start: Date, planName: string, fallbackDays?: number) => {
  const n = normalize(planName);
  if (n.includes("mensual") || n.includes("familiar")) return addMonthsSameDay(start, 1);
  if (n.includes("quincenal")) return addDays(start, 14);
  if (n.includes("semanal")) return addDays(start, 7);
  if (n.includes("sesion") || n.includes("sesión")) return new Date(start); // mismo día
  // fallback a duration_days si existe
  return fallbackDays ? addDays(start, fallbackDays) : addDays(start, 30);
};

// ========================= Componente =========================

const Clientes = () => {
  const [activeClients, setActiveClients] = useState<any[]>([]);
  const [inactiveClients, setInactiveClients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const { toast } = useToast();
  const [membershipPlans, setMembershipPlans] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    national_id: "",
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    emergency_contact: "",
    emergency_phone: "",
    birth_date: "",
    membership_plan_id: "",
    payment_method: "cash"
  });
  const [maxResults, setMaxResults] = useState("5");

  // ---------- Marca como expired por fecha cuando corresponda ----------
  const expireOutdatedMemberships = async (clients: any[]) => {
    const toExpire = clients
      .map((c) => c.latestMembership)
      .filter((m: any) => m && m.end_date && isExpiredByDate(m.end_date) && m.status !== "expired");

    if (toExpire.length === 0) return;

    try {
      await Promise.all(
        toExpire.map((m: any) =>
          supabase.from("memberships").update({ status: "expired" }).eq("id", m.id)
        )
      );
    } catch {
      // no bloquea UI
    }
  };

  // ---------- Fetch helpers ----------
  const fetchMembershipPlans = async () => {
    const { data, error } = await supabase
      .from("membership_plans")
      .select("*")
      .eq("status", "active");
    if (!error) setMembershipPlans(data || []);
  };

  const fetchClientsWithLatestMembership = async () => {
    const { data, error } = await supabase
      .from("clients")
      .select(`
        *,
        memberships (
          id, plan_id, status, start_date, end_date, payments, created_at,
          membership_plans ( name, price )
        )
      `)
      .order("created_at", { foreignTable: "memberships", ascending: false })
      .limit(1, { foreignTable: "memberships" });

    if (error) {
      console.error("Error fetching clients:", error);
      toast({
        title: "Error al cargar clientes",
        description: error.message,
        variant: "destructive"
      });
      return [];
    }

    const mapped = (data || []).map((client: any) => ({
      ...client,
      latestMembership: client.memberships?.[0] ?? null,
    }));

    await expireOutdatedMemberships(mapped);

    // ajusta en memoria para clasificar sin re-fetch
    const refreshed = mapped.map((c: any) => {
      if (c.latestMembership && isExpiredByDate(c.latestMembership.end_date)) {
        return { ...c, latestMembership: { ...c.latestMembership, status: "expired" } };
      }
      return c;
    });

    return refreshed;
  };

  const classifyClients = (clients: any[]) => {
    const actives: any[] = [];
    const inactives: any[] = [];

    clients.forEach((client) => {
      const lm = client.latestMembership;
      if (!lm) {
        inactives.push(client);
        return;
      }
      // Activo si hoy <= end_date (inclusive) o si status=active
      if (isValidByDate(lm.end_date) || lm.status === "active") {
        actives.push(client);
      } else {
        inactives.push(client);
      }
    });

    setActiveClients(actives);
    setInactiveClients(inactives);
  };

  // ---------- Carga inicial ----------
  useEffect(() => {
    const load = async () => {
      await fetchMembershipPlans();
      const clients = await fetchClientsWithLatestMembership();
      classifyClients(clients);
    };
    load();
  }, []);

  useEffect(() => {
    if (searchTerm === "") setSearchResults([]);
  }, [searchTerm]);

  const resetForm = () => {
    setFormData({
      national_id: "",
      first_name: "",
      last_name: "",
      phone: "",
      email: "",
      emergency_contact: "",
      emergency_phone: "",
      birth_date: "",
      membership_plan_id: "",
      payment_method: "cash"
    });
    setSelectedClient(null);
  };

  // ---------- Crear / actualizar ----------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (selectedClient) {
        const { error } = await supabase
          .from("clients")
          .update({
            national_id: formData.national_id,
            first_name: formData.first_name,
            last_name: formData.last_name,
            phone: formData.phone || null,
            email: formData.email || null,
            emergency_contact: formData.emergency_contact || null,
            emergency_phone: formData.emergency_phone || null,
            birth_date: formData.birth_date || null
          })
          .eq("id", selectedClient.id);

        if (error) throw error;

        toast({ title: "Cliente actualizado", description: "Datos actualizados exitosamente" });
      } else {
        // Crear cliente
        const { data: clientData, error: clientError } = await supabase
          .from("clients")
          .insert({
            national_id: formData.national_id,
            first_name: formData.first_name,
            last_name: formData.last_name,
            phone: formData.phone || null,
            email: formData.email || null,
            emergency_contact: formData.emergency_contact || null,
            emergency_phone: formData.emergency_phone || null,
            birth_date: formData.birth_date || null
          })
          .select()
          .single();

        if (clientError) throw clientError;

        // Si se eligió plan, crea membresía con end_date según reglas
        if (formData.membership_plan_id) {
          const selectedPlan = membershipPlans.find((p) => p.id === formData.membership_plan_id);
          if (selectedPlan) {
            const startDateLocal = toDateOnly(new Date()); // hoy local
            const computedEnd = computeEndDateByPlanName(
              startDateLocal,
              selectedPlan.name,
              selectedPlan.duration_days
            );

            const { error: membershipError } = await supabase
              .from("memberships")
              .insert({
                member_id: clientData.id,
                plan_id: selectedPlan.id,
                start_date: fmtISODateOnlyLocal(startDateLocal),
                end_date: fmtISODateOnlyLocal(computedEnd),
                status: "active",
                payments: formData.payment_method
              });

            if (membershipError) throw membershipError;
          }
        }

        toast({ title: "Cliente creado", description: "Cliente y membresía registrados" });
      }

      const clients = await fetchClientsWithLatestMembership();
      classifyClients(clients);

      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo procesar la solicitud",
        variant: "destructive"
      });
    }
  };

  const openEditDialog = (client: any) => {
    setSelectedClient(client);
    setFormData({
      national_id: client.national_id,
      first_name: client.first_name,
      last_name: client.last_name,
      phone: client.phone || "",
      email: client.email || "",
      emergency_contact: client.emergency_contact || "",
      emergency_phone: client.emergency_phone || "",
      birth_date: client.birth_date || "",
      membership_plan_id: client.latestMembership?.plan_id || "",
      payment_method: client.latestMembership?.payments || "cash"
    });
    setIsDialogOpen(true);
  };

  // ---------- Búsqueda ----------
  const buscarCliente = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingrese un nombre o apellido para buscar",
        variant: "destructive"
      });
      return;
    }

    setIsSearching(true);
    try {
      let query = supabase
        .from("clients")
        .select(`
          *,
          memberships (
            id, plan_id, status, start_date, end_date, payments, created_at,
            membership_plans ( name, price )
          )
        `)
        .order("created_at", { foreignTable: "memberships", ascending: false })
        .limit(1, { foreignTable: "memberships" });

      const tokens = searchTerm.trim().split(/\s+/);
      const orFilters = tokens
        .map((t) => `first_name.ilike.%${t}%,last_name.ilike.%${t}%`)
        .join(",");
      query = query.or(orFilters);

      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        toast({
          title: "Cliente no encontrado",
          description: "No se encontró un cliente con esa búsqueda",
          variant: "destructive"
        });
        setSearchResults([]);
        return;
      }

      const mapped = data.map((client: any) => ({
        ...client,
        latestMembership: client.memberships?.[0] ?? null,
      }));

      await expireOutdatedMemberships(mapped);

      const refreshed = mapped.map((c: any) => {
        if (c.latestMembership && isExpiredByDate(c.latestMembership.end_date)) {
          return { ...c, latestMembership: { ...c.latestMembership, status: "expired" } };
        }
        return c;
      });

      setSearchResults(refreshed);
    } catch {
      toast({
        title: "Error",
        description: "Error al buscar el cliente",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  // ---------- Validación para UI ----------
  const validarMembresia = (client: any) => {
    const lm = client.latestMembership;
    if (!lm) return { valid: false, message: "Sin membresía activa" };
    if (isValidByDate(lm.end_date) && lm.status === "active") return { valid: true, message: "Membresía válida" };
    if (isValidByDate(lm.end_date)) return { valid: true, message: "Membresía válida" };
    return { valid: false, message: "Sin membresía activa" };
  };

  // ---------- Tarjeta de resultado de búsqueda ----------
  const SearchResultCard = ({ client, openEditDialog }: any) => (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">
          {client.first_name} {client.last_name}
        </h3>
        {validarMembresia(client).valid ? (
          <CheckCircle className="h-6 w-6 text-green-500" />
        ) : (
          <XCircle className="h-6 w-6 text-red-500" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Cédula:</p>
          <p>{client.national_id}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Teléfono:</p>
          <p>{client.phone || 'No registrado'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Email:</p>
          <p>{client.email || 'No registrado'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Contacto de Emergencia:</p>
          <p>{client.emergency_contact || 'No registrado'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Telefono de Emergencia:</p>
          <p>{client.emergency_phone || 'No registrado'}</p>
        </div>
      </div>

      <div className={`p-2 rounded text-sm text-center mt-4 ${validarMembresia(client).valid
          ? 'bg-green-100 text-green-800'
          : 'bg-red-100 text-red-800'
        }`}>
        {validarMembresia(client).message}
      </div>

      {client.latestMembership && (
        <div className="text-sm">
          <p className="text-muted-foreground">Membresía actual:</p>
          <p>{client.latestMembership?.membership_plans?.name || 'N/A'}</p>
          {/* imprime EXACTO desde la DB */}
          <p>Vence: {printDBDate(client.latestMembership.end_date)}</p>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button size="sm" onClick={() => openEditDialog(client)}>
          <Edit className="h-4 w-4 mr-2" />
          Editar Cliente
        </Button>
      </div>
    </div>
  );

  // ========================= Render =========================

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-primary mb-2">Gestión de Clientes</h1>
              <p className="text-muted-foreground">Buscar y administrar clientes</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Nuevo Cliente
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{selectedClient ? 'Editar Cliente' : 'Agregar Nuevo Cliente'}</DialogTitle>
                  <DialogDescription>
                    {selectedClient ? 'Actualizar los datos del cliente' : 'Complete la información del nuevo cliente'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="national_id">Cédula</Label>
                      <Input
                        id="national_id"
                        value={formData.national_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, national_id: e.target.value }))}
                        placeholder="1-2345-6789"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="first_name">Nombre</Label>
                      <Input
                        id="first_name"
                        value={formData.first_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                        placeholder="Nombre del cliente"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="last_name">Apellidos</Label>
                      <Input
                        id="last_name"
                        value={formData.last_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                        placeholder="Apellidos del cliente"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Teléfono</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="8888-8888"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">Correo</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="cliente@email.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="birth_date">Fecha de Nacimiento</Label>
                      <Input
                        id="birth_date"
                        type="date"
                        value={formData.birth_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, birth_date: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="emergency_contact">Contacto de Emergencia</Label>
                      <Input
                        id="emergency_contact"
                        value={formData.emergency_contact}
                        onChange={(e) => setFormData(prev => ({ ...prev, emergency_contact: e.target.value }))}
                        placeholder="Nombre del contacto"
                      />
                    </div>
                    <div>
                      <Label htmlFor="emergency_phone">Teléfono de Emergencia</Label>
                      <Input
                        id="emergency_phone"
                        value={formData.emergency_phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, emergency_phone: e.target.value }))}
                        placeholder="7777-7777"
                      />
                    </div>
                  </div>

                  {!selectedClient && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="membership_plan">Tipo de Membresía</Label>
                          <Select value={formData.membership_plan_id} onValueChange={(value) => setFormData(prev => ({ ...prev, membership_plan_id: value }))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar membresía" />
                            </SelectTrigger>
                            <SelectContent>
                              {membershipPlans.map((plan) => (
                                <SelectItem key={plan.id} value={plan.id}>
                                  {plan.name} - ₡{Number(plan.price).toLocaleString('es-CR')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="payment_method">Método de Pago</Label>
                          <Select value={formData.payment_method} onValueChange={(value) => setFormData(prev => ({ ...prev, payment_method: value }))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar método" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash">Efectivo</SelectItem>
                              <SelectItem value="card">Tarjeta</SelectItem>
                              <SelectItem value="transfer">Transferencia</SelectItem>
                              <SelectItem value="sinpe">SINPE Móvil</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </>
                  )}

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">
                      {selectedClient ? 'Actualizar Cliente' : 'Agregar Cliente'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Buscador */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Buscar Cliente</CardTitle>
              <CardDescription>Busque un cliente por nombre o apellido</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="search">Nombre o apellido</Label>
                <div className="flex gap-2">
                  <Input
                    id="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    onKeyDown={(e) => e.key === 'Enter' && buscarCliente()}
                  />
                  <Button onClick={buscarCliente} disabled={isSearching}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-4">
                  {searchResults.map((client) => (
                    <SearchResultCard key={client.id} client={client} openEditDialog={openEditDialog} />
                  ))}
                </div>
              )}
              {searchResults.length === 0 && searchTerm.length > 0 && !isSearching && (
                <div className="text-center text-muted-foreground py-8">
                  No se encontraron clientes con su búsqueda.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Listas Activos / Inactivos (solo si no hay resultados de búsqueda) */}
          {searchResults.length === 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Activos */}
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <CardTitle>Clientes Activos</CardTitle>
                    <CardDescription>Miembros con membresía vigente</CardDescription>
                  </div>
                  <Select onValueChange={(value) => setMaxResults(value)} defaultValue="5">
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Mostrar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">Mostrar 5</SelectItem>
                      <SelectItem value="10">Mostrar 10</SelectItem>
                      <SelectItem value="20">Mostrar 20</SelectItem>
                      <SelectItem value="all">Mostrar todos</SelectItem>
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] rounded-md border p-4">
                    <div className="space-y-4">
                      {activeClients.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                          No hay clientes activos registrados
                        </div>
                      ) : (
                        activeClients
                          .slice(0, maxResults === "all" ? activeClients.length : parseInt(maxResults))
                          .map((cliente) => (
                            <div key={cliente.id} className="border rounded-lg p-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h3 className="font-semibold">{cliente.first_name} {cliente.last_name}</h3>
                                  <p className="text-sm text-muted-foreground">Cédula: {cliente.national_id}</p>
                                  <p className="text-sm">Teléfono: {cliente.phone || 'No registrado'}</p>
                                  <p className="text-sm">Email: {cliente.email || 'No registrado'}</p>
                                  <p className="text-sm">Contacto de emergencia: {cliente.emergency_contact || 'No registrado'}</p>
                                  <p className="text-sm">Telefono de Emergencia: {cliente.emergency_phone || 'No registrado'}</p>
                                  {cliente.latestMembership ? (
                                    <div className="mt-2">
                                      <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded mr-2">
                                        {cliente.latestMembership?.membership_plans?.name || 'Plan no especificado'}
                                      </span>
                                      <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                        {(() => {
                                          const pm = cliente.latestMembership?.payments;
                                          if (pm === 'cash') return 'Efectivo';
                                          if (pm === 'card') return 'Tarjeta';
                                          if (pm === 'transfer') return 'Transferencia';
                                          if (pm === 'sinpe') return 'SINPE';
                                          return pm || 'Sin registro de pago';
                                        })()}
                                      </span>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {/* imprime EXACTO el valor guardado en DB */}
                                        Vence: {printDBDate(cliente.latestMembership.end_date)}
                                      </p>
                                    </div>
                                  ) : (
                                    <span className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                                      Sin membresía activa
                                    </span>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" onClick={() => openEditDialog(cliente)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Inactivos */}
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <CardTitle>Clientes Inactivos</CardTitle>
                    <CardDescription>Última membresía vencida</CardDescription>
                  </div>
                  <Select onValueChange={(value) => setMaxResults(value)} defaultValue="5">
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Mostrar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">Mostrar 5</SelectItem>
                      <SelectItem value="10">Mostrar 10</SelectItem>
                      <SelectItem value="20">Mostrar 20</SelectItem>
                      <SelectItem value="all">Mostrar todos</SelectItem>
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] rounded-md border p-4">
                    <div className="space-y-4">
                      {inactiveClients.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                          No hay clientes inactivos registrados
                        </div>
                      ) : (
                        inactiveClients
                          .slice(0, maxResults === "all" ? inactiveClients.length : parseInt(maxResults))
                          .map((cliente) => (
                            <div key={cliente.id} className="border rounded-lg p-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h3 className="font-semibold">{cliente.first_name} {cliente.last_name}</h3>
                                  <p className="text-sm text-muted-foreground">Cédula: {cliente.national_id}</p>
                                  <p className="text-sm">Teléfono: {cliente.phone || 'No registrado'}</p>
                                  <p className="text-sm">Email: {cliente.email || 'No registrado'}</p>
                                  <p className="text-sm">Contacto de emergencia: {cliente.emergency_contact || 'No registrado'}</p>
                                  <p className="text-sm">Telefono de Emergencia: {cliente.emergency_phone || 'No registrado'}</p>
                                  <div className="mt-2">
                                    <span className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                                      {cliente.latestMembership
                                        ? `Último plan: ${cliente.latestMembership.membership_plans?.name || "N/A"}`
                                        : "Sin membresía"}
                                    </span>
                                    {cliente.latestMembership && (
                                      <div className="mt-2">
                                        <p className="text-xs text-muted-foreground">
                                          {/* imprime EXACTO el valor guardado en DB */}
                                          Venció: {printDBDate(cliente.latestMembership.end_date)}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" onClick={() => openEditDialog(cliente)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Clientes;