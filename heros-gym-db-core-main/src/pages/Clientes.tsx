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

const Clientes = () => {
  const [activeClients, setActiveClients] = useState([]);
  const [inactiveClients, setInactiveClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResult, setSearchResult] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [planes, setPlanes] = useState([]);
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
      // Obtener todos los clientes con sus membresías
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
        `)
        .eq('status', 'active');
      
      if (error) {
        console.error('Error fetching clients:', error);
        return;
      }

      // Separar clientes activos e inactivos basándose en membresías
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
        // Actualizar cliente existente
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
        
        // Refresh clients
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
          `)
          .eq('status', 'active');
        
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
        // Crear nuevo cliente
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

        // Si se seleccionó una membresía, crear la membresía y el pago
        if (formData.membership_plan_id) {
          const selectedPlan = membershipPlans.find(plan => plan.id === formData.membership_plan_id);
          if (selectedPlan) {
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(startDate.getDate() + selectedPlan.duration_days);

            // Crear membresía con método de pago
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
        
        // Refresh clients
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
          `)
          .eq('status', 'active');
        
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
      membership_plan_id: "",
      payment_method: "cash"
    });
    setIsDialogOpen(true);
  };

  const buscarCliente = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingrese una cédula para buscar",
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
        .eq('national_id', searchTerm)
        .maybeSingle();
      
      if (error || !data) {
        toast({
          title: "Cliente no encontrado",
          description: "No se encontró un cliente con esa cédula",
          variant: "destructive"
        });
        setSearchResult(null);
        return;
      }

      setSearchResult(data);
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

        {/* Buscador de clientes */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Buscar Cliente</CardTitle>
            <CardDescription>Busque un cliente específico por cédula</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="search">Cédula del Cliente</Label>
              <div className="flex gap-2">
                <Input
                  id="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Ej: 1-2345-6789"
                  onKeyPress={(e) => e.key === 'Enter' && buscarCliente()}
                />
                <Button onClick={buscarCliente} disabled={isSearching}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {searchResult && (
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">
                    {searchResult.first_name} {searchResult.last_name}
                  </h3>
                  {validarMembresia(searchResult.memberships).valid ? (
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-500" />
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Cédula:</p>
                    <p>{searchResult.national_id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Teléfono:</p>
                    <p>{searchResult.phone || 'No registrado'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email:</p>
                    <p>{searchResult.email || 'No registrado'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Estado:</p>
                    <span className={`inline-block px-2 py-1 rounded text-xs ${
                      searchResult.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {searchResult.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>

                <div className={`p-2 rounded text-sm text-center ${
                  validarMembresia(searchResult.memberships).valid 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {validarMembresia(searchResult.memberships).message}
                </div>

                {searchResult.memberships && searchResult.memberships.length > 0 && (
                  <div className="text-sm">
                    <p className="text-muted-foreground">Membresía actual:</p>
                    <p>{searchResult.memberships[0].membership_plans?.name}</p>
                    <p>Vence: {new Date(searchResult.memberships[0].end_date).toLocaleDateString()}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={() => openEditDialog(searchResult)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar Cliente
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Clientes Activos */}
          <Card>
            <CardHeader>
              <CardTitle>Clientes Activos</CardTitle>
              <CardDescription>Lista de miembros con membresías vigentes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeClients.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No hay clientes activos registrados
                  </div>
                ) : (
                  activeClients.map((cliente) => (
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
                          <Button size="sm" variant="outline">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Clientes Inactivos */}
          <Card>
            <CardHeader>
              <CardTitle>Clientes Inactivos</CardTitle>
              <CardDescription>Lista de miembros sin membresías activas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {inactiveClients.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No hay clientes inactivos registrados
                  </div>
                ) : (
                  inactiveClients.map((cliente) => (
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
                          <Button size="sm" variant="outline">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    </div>
  );
};

export default Clientes;