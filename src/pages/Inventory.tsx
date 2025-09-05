import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, ArrowDown, ArrowUp, PackageSearch } from "lucide-react";

interface InventoryItem {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  sku: string | null;
  category: string | null;
  quantity: number;
  unit_price: number | null;
  low_stock_threshold: number | null;
  created_at: string;
  updated_at: string;
}

const currency = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" });

const Inventory = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState<number>(0);
  const [unitPrice, setUnitPrice] = useState<string>("");
  const [threshold, setThreshold] = useState<number>(10);
  const [search, setSearch] = useState<string>("");

  // SEO: Title, description, canonical
  useEffect(() => {
    const title = "Inventory Management | Inventory Tonic"; // <60 chars
    const description = "Manage inventory items, add products, and update stock levels."; // <160
    document.title = title;

    const setMeta = (name: string, content: string) => {
      let tag = document.querySelector(`meta[name="${name}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", name);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };
    setMeta("description", description);

    let canonical = document.querySelector("link[rel=canonical]") as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = window.location.origin + "/inventory";
  }, []);

  const { data: items, isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["inventory-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as InventoryItem[];
    },
    enabled: !!user && !loading,
  });

  const addItem = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (!name.trim()) throw new Error("Name is required");

      const { error } = await supabase.from("inventory_items").insert({
        user_id: user.id,
        name: name.trim(),
        description: description.trim() || null,
        sku: sku.trim() || null,
        category: category.trim() || null,
        quantity: Number.isFinite(quantity) ? quantity : 0,
        unit_price: unitPrice ? Number(parseFloat(unitPrice).toFixed(2)) : null,
        low_stock_threshold: Number.isFinite(threshold) ? threshold : 10,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      setName("");
      setSku("");
      setCategory("");
      setDescription("");
      setQuantity(0);
      setUnitPrice("");
      setThreshold(10);
      toast({ title: "Item added", description: "New item has been added to your inventory." });
    },
    onError: (err: any) => {
      toast({ title: "Add failed", description: err.message || "Could not add item.", variant: "destructive" });
    },
  });

  const updateQuantity = useMutation({
    mutationFn: async ({ id, newQty }: { id: string; newQty: number }) => {
      const { error } = await supabase
        .from("inventory_items")
        .update({ quantity: newQty })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message || "Could not update stock.", variant: "destructive" });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      toast({ title: "Item deleted", description: "The item was removed from your inventory." });
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err.message || "Could not delete item.", variant: "destructive" });
    },
  });

  const filtered = useMemo(() => {
    if (!items) return [] as InventoryItem[];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      [it.name, it.sku, it.category, it.description]
        .filter(Boolean)
        .some((f) => (f as string).toLowerCase().includes(q))
    );
  }, [items, search]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Inventory Management</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/")}>Dashboard</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <section className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Add Item</CardTitle>
              <CardDescription>Quickly add a new product to your inventory</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Blue T-Shirt" />
                </div>
                <div>
                  <Label htmlFor="sku">SKU</Label>
                  <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. TS-BLU-001" />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Apparel" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details" />
                </div>
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    inputMode="numeric"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value || "0", 10))}
                    min={0}
                  />
                </div>
                <div>
                  <Label htmlFor="unit_price">Unit Price</Label>
                  <Input
                    id="unit_price"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    placeholder="e.g. 19.99"
                  />
                </div>
                <div>
                  <Label htmlFor="threshold">Low Stock Threshold</Label>
                  <Input
                    id="threshold"
                    type="number"
                    inputMode="numeric"
                    value={threshold}
                    onChange={(e) => setThreshold(parseInt(e.target.value || "0", 10))}
                    min={0}
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={() => addItem.mutate()} disabled={addItem.isPending}>
                  <Plus className="mr-2" /> Add Item
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">Items</h2>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search by name, SKU, or category"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
                aria-label="Search inventory"
              />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardDescription>Manage your stock levels and products</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground"><PackageSearch className="h-4 w-4" /> Loading items...</div>
              ) : filtered.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">No items found. Add your first item above.</div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((it) => {
                        const low = typeof it.low_stock_threshold === "number" && it.quantity <= it.low_stock_threshold;
                        return (
                          <TableRow key={it.id} className={low ? "bg-destructive/10" : undefined}>
                            <TableCell>
                              <div className="font-medium">{it.name}</div>
                              {it.description ? (
                                <div className="text-sm text-muted-foreground">{it.description}</div>
                              ) : null}
                            </TableCell>
                            <TableCell>{it.sku || "-"}</TableCell>
                            <TableCell>{it.category || "-"}</TableCell>
                            <TableCell className={`text-right font-medium ${low ? "text-destructive" : ""}`}>{it.quantity}</TableCell>
                            <TableCell className="text-right">{it.unit_price != null ? currency.format(it.unit_price) : "-"}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => updateQuantity.mutate({ id: it.id, newQty: Math.max(0, it.quantity - 1) })}
                                  aria-label={`Decrease ${it.name} quantity`}
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => updateQuantity.mutate({ id: it.id, newQty: it.quantity + 1 })}
                                  aria-label={`Increase ${it.name} quantity`}
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Separator orientation="vertical" className="h-6" />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    if (confirm("Delete this item?")) deleteItem.mutate(it.id);
                                  }}
                                  aria-label={`Delete ${it.name}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default Inventory;
