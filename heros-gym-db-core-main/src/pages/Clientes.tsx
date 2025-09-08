import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Search, CheckCircle, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import TopNavigation from "@/components/TopNavigation";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Clientes = () => {
  const [activeClients, setActiveClients] = useState([]);
  const [inactiveClients, setInactiveClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]); // Cambiado a un array para múltiples resultados
  const [isSearching, setIsSearching] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientToDelete, setClientToDelete] = useState(null);
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

  useEffect(() => {
    const fetchMembershipPlans = async () => {
      const { data, error } = await supabase
        .from('membership_plans')
        .select('*')
        .eq('status', 'active');
      
      if (!error) {
        setMembershipPlans(data || []);
      }
    };
    
    const fetchClients = async () => {
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
            membership_plans (
              name,
              price
            )
          )
        `);
      
      if (error) {
        console.error('Error fetching clients:', error);
        return;
      }

      const activeClientsList = [];
      const inactiveClientsList = [];

      allClients?.forEach(client => {
        const hasActiveMembership = client.memberships?.some(membership => membership.status === 'active');
        
        if (hasActiveMembership) {
          activeClientsList.push(client);
        } else {
          inactiveClientsList.push(client);
        }
      });

      setActiveClients(activeClientsList);
      setInactiveClients(inactiveClientsList);
    };
    
    fetchMembershipPlans();
    fetchClients();
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

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientToDelete.id);

      if (error) throw error;

      toast({
        title: "Cliente eliminado",
        description: `El cliente ${clientToDelete.first_name} ${clientToDelete.last_name} ha sido eliminado exitosamente.`,
      });

      setClientToDelete(null);
      // Actualizar la lista de clientes
      const { data } = await supabase
        .from('clients')
        .select(`
          *,
          memberships (
            id,
            status,
            start_date,
            end_date,
            payments,
            membership_plans (
              name,
              price
            )
          )
        `);

      if (data) {
        const activeList = [];
        const inactiveList = [];
        data.forEach(client => {
          const hasActiveMembership = client.memberships?.some(membership => membership.status === 'active');
          if (hasActiveMembership) {
            activeList.push(client);
          } else {
            inactiveList.push(client);
          }
        });
        setActiveClients(activeList);
        setInactiveClients(inactiveList);
      }

      setSearchResults([]);
      setSearchTerm("");

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar al cliente.",
        variant: "destructive",
      });
    }
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
        
        const { data } = await supabase
          .from('clients')
          .select(`
            *,
            memberships (
              id,
              status,
              start_date,
              end_date,
              payments,
              membership_plans (
                name,
                price
              )
            )
          `);
        
        if (data) {
          const activeList = [];
          const inactiveList = [];

          data.forEach(client => {
            const hasActiveMembership = client.memberships?.some(membership => membership.status === 'active');
            
            if (hasActiveMembership) {
              activeList.push(client);
            } else {
              inactiveList.push(client);
            }
          });

          setActiveClients(activeList);
          setInactiveClients(inactiveList);
        }
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
            endDate.setDate(startDate.getDate() + selectedPlan.duration_days);

            const { error: membershipError } = await supabase
              .from('memberships')
              .insert({
                member_id: clientData.id,
                plan_id: selectedPlan.id,
                start_date: startDate.toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0],
                status: 'active',
                payments: formData.payment_method
              });

            if (membershipError) throw membershipError;
          }
        }

        toast({
          title: "Cliente creado",
          description: "El cliente y su membresía han sido registrados exitosamente"
        });
        
        const { data } = await supabase
          .from('clients')
          .select(`
            *,
            memberships (
              id,
              status,
              start_date,
              end_date,
              payments,
              membership_plans (
                name,
                price
              )
            )
          `);
        
        if (data) {
          const activeList = [];
          const inactiveList = [];

          data.forEach(client => {
            const hasActiveMembership = client.memberships?.some(membership => membership.status === 'active');
            
            if (hasActiveMembership) {
              activeList.push(client);
            } else {
              inactiveList.push(client);
            }
          });

          setActiveClients(activeList);
          setInactiveClients(inactiveList);
        }
      }
      
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
    const activeMembership = client.memberships?.find(m => m.status === 'active');
    
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
      membership_plan_id: activeMembership?.plan_id || "",
      payment_method: activeMembership?.payments || "cash"
    });
    setIsDialogOpen(true);
  };

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

      setSearchResults(data);
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

  const validarMembresia = (memberships: any[]) => {
    if (!memberships || memberships.length === 0) return { valid: false, message: "Sin membresía activa" };
    
    const activeMembresia = memberships.find(m => m.status === 'active');
    if (!activeMembresia) return { valid: false, message: "Sin membresía activa" };
    
    const endDate = new Date(activeMembresia.end_date);
    const today = new Date();
    
    if (endDate < today) return { valid: false, message: "Membresía vencida" };
    
    return { valid: true, message: "Membresía válida" };
  };

  const SearchResultCard = ({ client, openEditDialog, setClientToDelete }) => (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">
          {client.first_name} {client.last_name}
        </h3>
        {validarMembresia(client.memberships).valid ? (
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
          <p className="text-muted-foreground">Estado:</p>
          <span className={`inline-block px-2 py-1 rounded text-xs ${
            client.status === 'active' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {client.status === 'active' ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </div>

      <div className={`p-2 rounded text-sm text-center ${
        validarMembresia(client.memberships).valid 
          ? 'bg-green-100 text-green-800' 
          : 'bg-red-100 text-red-800'
      }`}>
        {validarMembresia(client.memberships).message}
      </div>

      {client.memberships && client.memberships.length > 0 && (
        <div className="text-sm">
          <p className="text-muted-foreground">Membresía actual:</p>
          <p>{client.memberships[0].membership_plans?.name}</p>
          <p>Vence: {new Date(client.memberships[0].end_date).toLocaleDateString()}</p>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button size="sm" onClick={() => openEditDialog(client)}>
          <Edit className="h-4 w-4 mr-2" />
          Editar Cliente
        </Button>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setClientToDelete(client)}>
            <Trash2 className="h-4 w-4" />
            Eliminar Cliente
          </Button>
        </AlertDialogTrigger>
      </div>
    </div>
  );

  const DisplayClients = () => {
    if (searchResults.length > 0) {
      return (
        <div className="space-y-4">
          {searchResults.map((client) => (
            <SearchResultCard key={client.id} client={client} openEditDialog={openEditDialog} setClientToDelete={setClientToDelete} />
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
                          {cliente.memberships && cliente.memberships.length > 0 && (
                            <div className="mt-2">
                              {cliente.memberships
                                .filter(membership => membership.status === 'active')
                                .map((membership, index) => (
                                  <div key={index} className="mb-2">
                                    <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded mr-2">
                                      {membership.membership_plans?.name || 'Plan no especificado'}
                                    </span>
                                    <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                      {membership.payments === 'cash' ? 'Efectivo' : 
                                       membership.payments === 'card' ? 'Tarjeta' :
                                       membership.payments === 'transfer' ? 'Transferencia' :
                                       membership.payments === 'sinpe' ? 'SINPE' : membership.payments}
                                    </span>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Vence: {new Date(membership.end_date).toLocaleDateString('es-CR')}
                                    </p>
                                  </div>
                                ))
                              }
                              {cliente.memberships.filter(m => m.status === 'active').length === 0 && (
                                <span className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                                  Sin membresía activa
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(cliente)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setClientToDelete(cliente)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
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
                            {cliente.memberships && cliente.memberships.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs text-muted-foreground">Última membresía:</p>
                                <div className="text-xs">
                                  {cliente.memberships[cliente.memberships.length - 1].membership_plans?.name || 'Plan no especificado'}
                                  <span className="text-muted-foreground ml-2">
                                    (Venció: {new Date(cliente.memberships[cliente.memberships.length - 1].end_date).toLocaleDateString('es-CR')})
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
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setClientToDelete(cliente)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
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
              <h1 className="text-3xl font-bold text-primary mb-2">Gestión de Clientes y Membresías</h1>
              <p className="text-muted-foreground">Buscar y administrar clientes y sus membresías</p>
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
          <AlertDialog>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Buscador de clientes */}
              <Card className="col-span-1 lg:col-span-2">
                <CardHeader>
                  <CardTitle>Buscar Cliente</CardTitle>
                  <CardDescription>Busque un cliente por nombre, apellido o cédula</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="search">Nombre, apellido o cédula</Label>
                    <div className="flex gap-2">
                      <Input
                        id="search"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Ej: Juan Pérez o 1-2345-6789"
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
                        <SearchResultCard key={client.id} client={client} openEditDialog={openEditDialog} setClientToDelete={setClientToDelete} />
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
                <>
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
                                    {cliente.memberships && cliente.memberships.length > 0 && (
                                      <div className="mt-2">
                                        {cliente.memberships
                                          .filter(membership => membership.status === 'active')
                                          .map((membership, index) => (
                                            <div key={index} className="mb-2">
                                              <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded mr-2">
                                                {membership.membership_plans?.name || 'Plan no especificado'}
                                              </span>
                                              <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                                {membership.payments === 'cash' ? 'Efectivo' : 
                                                 membership.payments === 'card' ? 'Tarjeta' :
                                                 membership.payments === 'transfer' ? 'Transferencia' :
                                                 membership.payments === 'sinpe' ? 'SINPE' : membership.payments}
                                              </span>
                                              <p className="text-xs text-muted-foreground mt-1">
                                                Vence: {new Date(membership.end_date).toLocaleDateString('es-CR')}
                                              </p>
                                            </div>
                                          ))
                                        }
                                        {cliente.memberships.filter(m => m.status === 'active').length === 0 && (
                                          <span className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                                            Sin membresía activa
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => openEditDialog(cliente)}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <AlertDialogTrigger asChild>
                                      <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setClientToDelete(cliente)}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

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
                                      {cliente.memberships && cliente.memberships.length > 0 && (
                                        <div className="mt-2">
                                          <p className="text-xs text-muted-foreground">Última membresía:</p>
                                          <div className="text-xs">
                                            {cliente.memberships[cliente.memberships.length - 1].membership_plans?.name || 'Plan no especificado'}
                                            <span className="text-muted-foreground ml-2">
                                              (Venció: {new Date(cliente.memberships[cliente.memberships.length - 1].end_date).toLocaleDateString('es-CR')})
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
                                    <AlertDialogTrigger asChild>
                                      <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setClientToDelete(cliente)}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Está seguro de que desea eliminar a este cliente?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Esto eliminará permanentemente los datos de este cliente de la base de datos, incluyendo sus membresías y registros de asistencia.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setClientToDelete(null)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDeleteClient}>Eliminar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};

// Componente para mostrar un solo cliente en los resultados de la búsqueda
const SearchResultCard = ({ client, openEditDialog, setClientToDelete }) => {
  const validarMembresia = (memberships: any[]) => {
    if (!memberships || memberships.length === 0) return { valid: false, message: "Sin membresía activa" };
    
    const activeMembresia = memberships.find(m => m.status === 'active');
    if (!activeMembresia) return { valid: false, message: "Sin membresía activa" };
    
    const endDate = new Date(activeMembresia.end_date);
    const today = new Date();
    
    if (endDate < today) return { valid: false, message: "Membresía vencida" };
    
    return { valid: true, message: "Membresía válida" };
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">
          {client.first_name} {client.last_name}
        </h3>
        {validarMembresia(client.memberships).valid ? (
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
          <p className="text-muted-foreground">Estado:</p>
          <span className={`inline-block px-2 py-1 rounded text-xs ${
            client.status === 'active' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {client.status === 'active' ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </div>

      <div className={`p-2 rounded text-sm text-center ${
        validarMembresia(client.memberships).valid 
          ? 'bg-green-100 text-green-800' 
          : 'bg-red-100 text-red-800'
      }`}>
        {validarMembresia(client.memberships).message}
      </div>

      {client.memberships && client.memberships.length > 0 && (
        <div className="text-sm">
          <p className="text-muted-foreground">Membresía actual:</p>
          <p>{client.memberships[0].membership_plans?.name}</p>
          <p>Vence: {new Date(client.memberships[0].end_date).toLocaleDateString()}</p>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button size="sm" onClick={() => openEditDialog(client)}>
          <Edit className="h-4 w-4 mr-2" />
          Editar Cliente
        </Button>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setClientToDelete(client)}>
            <Trash2 className="h-4 w-4" />
            Eliminar Cliente
          </Button>
        </AlertDialogTrigger>
      </div>
    </div>
  );
};

export default Clientes;
