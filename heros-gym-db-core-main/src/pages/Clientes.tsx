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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const Clientes = () => {
  const [activeClients, setActiveClients] = useState([]);
  const [inactiveClients, setInactiveClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const { toast } = useToast();
  const [membershipPlans, setMembershipPlans] = useState([]);
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

  // Función para obtener y clasificar a todos los clientes
  const fetchAndClassifyClients = async () => {
    const { data: allClients, error } = await supabase
      .from('clients')
      .select(`
        *,
        memberships (
          id,
          status,
          start_date,
          end_date,
          payments,
          created_at,
          membership_plans (
            name,
            price
          )
        )
      `);

    if (error) {
      console.error('Error fetching clients:', error);
      toast({
        title: "Error al cargar clientes",
        description: error.message,
        variant: "destructive"
      });
      return;
    }
    
    // Procesa los datos para encontrar la membresía más reciente de cada cliente
    const clientsWithLatestMembership = allClients?.map(client => {
        // Ordena las membresías por fecha de creación en orden descendente
        const sortedMemberships = client.memberships?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        // Asigna la membresía más reciente al cliente
        const latestMembership = sortedMemberships?.[0] || null;
        
        return {
            ...client,
            latestMembership
        };
    }) || [];
    
    const activeClientsList = [];
    const inactiveClientsList = [];

    clientsWithLatestMembership.forEach(client => {
      // Usa el status de la membresía más reciente para clasificar
      if (client.latestMembership?.status === 'active' && new Date(client.latestMembership.end_date) >= new Date()) {
        activeClientsList.push(client);
      } else {
        inactiveClientsList.push(client);
      }
    });

    setActiveClients(activeClientsList);
    setInactiveClients(inactiveClientsList);
  };
  
  useEffect(() => {
    // Al cargar la página, obtenemos los planes de membresía y los clientes
    const fetchMembershipPlans = async () => {
      const { data, error } = await supabase
        .from('membership_plans')
        .select('*')
        .eq('status', 'active');
      
      if (!error) {
        setMembershipPlans(data || []);
      }
    };
    
    fetchMembershipPlans();
    fetchAndClassifyClients();
  }, []);

  useEffect(() => {
    if (searchTerm === "") {
      setSearchResults([]);
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (selectedClient) {
        const { error } = await supabase
          .from('clients')
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
          .eq('id', selectedClient.id);

        if (error) throw error;

        toast({
          title: "Cliente actualizado",
          description: "Los datos del cliente han sido actualizados exitosamente"
        });
        
      } else {
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
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

        if (formData.membership_plan_id) {
          const selectedPlan = membershipPlans.find(plan => plan.id === formData.membership_plan_id);
          if (selectedPlan) {
            const startDate = new Date();
            const endDate = new Date();
            // Asume que la duración está en días.
            endDate.setDate(startDate.getDate() + selectedPlan.duration_days);

            const { error: membershipError } = await supabase
              .from('memberships')
              .insert({
                member_id: clientData.id,
                plan_id: selectedPlan.id,
                start_date: startDate.toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0],
                status: 'active',
                payments: formData.payment_method // Aquí se guarda el método de pago en la tabla memberships
              });

            if (membershipError) throw membershipError;
          }
        }

        toast({
          title: "Cliente creado",
          description: "El cliente y su membresía han sido registrados exitosamente"
        });
      }
      
      // Actualizamos la lista de clientes después de una operación exitosa
      fetchAndClassifyClients();
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
  
  // Función de búsqueda optimizada
  const buscarCliente = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingrese un nombre, apellido o cédula para buscar",
        variant: "destructive"
      });
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          memberships (
            id,
            status,
            start_date,
            end_date,
            payments,
            created_at,
            membership_plans (
              name,
              price
            )
          )
        `)
        .or(`national_id.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`);
      
      if (error || !data || data.length === 0) {
        toast({
          title: "Cliente no encontrado",
          description: "No se encontró un cliente con esa búsqueda",
          variant: "destructive"
        });
        setSearchResults([]);
        return;
      }

      const clientsWithLatestMembership = data.map(client => {
          const sortedMemberships = client.memberships?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          const latestMembership = sortedMemberships?.[0] || null;
          return {
              ...client,
              latestMembership
          };
      });

      setSearchResults(clientsWithLatestMembership);

    } catch (error) {
      toast({
        title: "Error",
        description: "Error al buscar el cliente",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  const validarMembresia = (client: any) => {
    const latestMembership = client.latestMembership;

    if (!latestMembership) {
        return { valid: false, message: "Sin membresía activa" };
    }
    
    if (latestMembership.status === 'active' && new Date(latestMembership.end_date) >= new Date()) {
        return { valid: true, message: "Membresía válida" };
    }
    
    return { valid: false, message: "Sin membresía activa" };
  };

  // Componente para mostrar un solo resultado de búsqueda
  const SearchResultCard = ({ client, openEditDialog }) => (
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
      </div>

      <div className={`p-2 rounded text-sm text-center mt-4 ${
        validarMembresia(client).valid 
          ? 'bg-green-100 text-green-800' 
          : 'bg-red-100 text-red-800'
      }`}>
        {validarMembresia(client).message}
      </div>

      {client.latestMembership && (
        <div className="text-sm">
          <p className="text-muted-foreground">Membresía actual:</p>
          <p>{client.latestMembership?.membership_plans?.name || 'N/A'}</p>
          <p>Vence: {new Date(client.latestMembership.end_date).toLocaleDateString('es-CR')}</p>
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

  const DisplayClients = () => {
    if (searchResults.length > 0) {
      return (
        <div className="space-y-4">
          {searchResults.map((client) => (
            <SearchResultCard key={client.id} client={client} openEditDialog={openEditDialog} />
          ))}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clientes Activos */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Clientes Activos</CardTitle>
              <CardDescription>Lista de miembros con membresías vigentes</CardDescription>
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
                  activeClients.slice(0, maxResults === "all" ? activeClients.length : parseInt(maxResults)).map((cliente) => (
                    <div key={cliente.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{cliente.first_name} {cliente.last_name}</h3>
                          <p className="text-sm text-muted-foreground">Cédula: {cliente.national_id}</p>
                          <p className="text-sm">Teléfono: {cliente.phone || 'No registrado'}</p>
                          <p className="text-sm">Email: {cliente.email || 'No registrado'}</p>
                          {cliente.latestMembership && (
                            <div className="mt-2">
                              <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded mr-2">
                                {cliente.latestMembership?.membership_plans?.name || 'Plan no especificado'}
                              </span>
                              <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                {cliente.latestMembership.payments === 'cash' ? 'Efectivo' :
                                 cliente.latestMembership.payments === 'card' ? 'Tarjeta' :
                                 cliente.latestMembership.payments === 'transfer' ? 'Transferencia' :
                                 cliente.latestMembership.payments === 'sinpe' ? 'SINPE' : cliente.latestMembership.payments}
                              </span>
                              <p className="text-xs text-muted-foreground mt-1">
                                Vence: {new Date(cliente.latestMembership.end_date).toLocaleDateString('es-CR')}
                              </p>
                            </div>
                          )}
                          {!cliente.latestMembership && (
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

        {/* Clientes Inactivos */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Clientes Inactivos</CardTitle>
              <CardDescription>Lista de miembros sin membresías activas</CardDescription>
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
                  inactiveClients.slice(0, maxResults === "all" ? inactiveClients.length : parseInt(maxResults)).map((cliente) => (
                    <div key={cliente.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{cliente.first_name} {cliente.last_name}</h3>
                          <p className="text-sm text-muted-foreground">Cédula: {cliente.national_id}</p>
                          <p className="text-sm">Teléfono: {cliente.phone || 'No registrado'}</p>
                          <p className="text-sm">Email: {cliente.email || 'No registrado'}</p>
                          <div className="mt-2">
                            <span className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                              Sin membresía activa
                            </span>
                            {cliente.latestMembership && (
                              <div className="mt-2">
                                <p className="text-xs text-muted-foreground">Última membresía:</p>
                                <div className="text-xs">
                                  {cliente.latestMembership.membership_plans?.name || 'Plan no especificado'}
                                  <span className="text-muted-foreground ml-2">
                                    Venció: {new Date(cliente.latestMembership.end_date).toLocaleDateString('es-CR')}
                                  </span>
                                </div>
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
    );
  };
  

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

        {/* Buscador de clientes */}
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
                  onKeyPress={(e) => e.key === 'Enter' && buscarCliente()}
                />
                <Button onClick={buscarCliente} disabled={isSearching}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Mostrar resultados de la búsqueda */}
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

        {/* Secciones de clientes activos e inactivos. Se muestran solo si no hay resultados de búsqueda. */}
        {searchResults.length === 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Clientes Activos */}
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Clientes Activos</CardTitle>
                  <CardDescription>Lista de miembros con membresías vigentes</CardDescription>
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
                      activeClients.slice(0, maxResults === "all" ? activeClients.length : parseInt(maxResults)).map((cliente) => (
                        <div key={cliente.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold">{cliente.first_name} {cliente.last_name}</h3>
                              <p className="text-sm text-muted-foreground">Cédula: {cliente.national_id}</p>
                              <p className="text-sm">Teléfono: {cliente.phone || 'No registrado'}</p>
                              <p className="text-sm">Email: {cliente.email || 'No registrado'}</p>
                              {cliente.latestMembership && (
                                <div className="mt-2">
                                  <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded mr-2">
                                    {cliente.latestMembership?.membership_plans?.name || 'Plan no especificado'}
                                  </span>
                                  <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                    {cliente.latestMembership.payments === 'cash' ? 'Efectivo' :
                                     cliente.latestMembership.payments === 'card' ? 'Tarjeta' :
                                     cliente.latestMembership.payments === 'transfer' ? 'Transferencia' :
                                     cliente.latestMembership.payments === 'sinpe' ? 'SINPE' : cliente.latestMembership.payments}
                                  </span>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Vence: {new Date(cliente.latestMembership.end_date).toLocaleDateString('es-CR')}
                                  </p>
                                </div>
                              )}
                              {!cliente.latestMembership && (
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

            {/* Clientes Inactivos */}
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Clientes Inactivos</CardTitle>
                  <CardDescription>Lista de miembros sin membresías activas</CardDescription>
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
                      inactiveClients.slice(0, maxResults === "all" ? inactiveClients.length : parseInt(maxResults)).map((cliente) => (
                        <div key={cliente.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold">{cliente.first_name} {cliente.last_name}</h3>
                              <p className="text-sm text-muted-foreground">Cédula: {cliente.national_id}</p>
                              <p className="text-sm">Teléfono: {cliente.phone || 'No registrado'}</p>
                              <p className="text-sm">Email: {cliente.email || 'No registrado'}</p>
                              <div className="mt-2">
                                <span className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                                  Sin membresía activa
                                </span>
                                {cliente.latestMembership && (
                                  <div className="mt-2">
                                    <p className="text-xs text-muted-foreground">Última membresía:</p>
                                    <div className="text-xs">
                                      {cliente.latestMembership.membership_plans?.name || 'Plan no especificado'}
                                      <span className="text-muted-foreground ml-2">
                                        Venció: {new Date(cliente.latestMembership.end_date).toLocaleDateString('es-CR')}
                                      </span>
                                    </div>
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

const SearchResultCard = ({ client, openEditDialog }) => {
  const validarMembresia = (client: any) => {
    const latestMembership = client.latestMembership;

    if (!latestMembership) {
        return { valid: false, message: "Sin membresía activa" };
    }
    
    if (latestMembership.status === 'active' && new Date(latestMembership.end_date) >= new Date()) {
        return { valid: true, message: "Membresía válida" };
    }
    
    return { valid: false, message: "Sin membresía activa" };
  };

  return (
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
      </div>

      <div className={`p-2 rounded text-sm text-center mt-4 ${
        validarMembresia(client).valid 
          ? 'bg-green-100 text-green-800' 
          : 'bg-red-100 text-red-800'
      }`}>
        {validarMembresia(client).message}
      </div>

      {client.latestMembership && (
        <div className="text-sm">
          <p className="text-muted-foreground">Membresía actual:</p>
          <p>{client.latestMembership?.membership_plans?.name || 'N/A'}</p>
          <p>Vence: {new Date(client.latestMembership.end_date).toLocaleDateString('es-CR')}</p>
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
};

export default Clientes;
