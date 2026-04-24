import { useState } from "react";
import { useCustomers, useArchiveCustomer } from "@/hooks/useSupabaseData";
import { formatAddress } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Eye, Pencil, Archive } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function CustomerManagement() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { data: customers = [], isLoading } = useCustomers();
  const archiveMutation = useArchiveCustomer();

  const filtered = customers.filter(
    (c) =>
      !c.archived &&
      (c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase()) ||
        c.serviceAddress.city.toLowerCase().includes(search.toLowerCase()) ||
        c.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())))
  );

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">Loading customers...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">{filtered.length} customers</p>
        </div>
        <Link to="/admin/customers/new">
          <Button><Plus className="h-4 w-4 mr-2" />Add Customer</Button>
        </Link>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search name, email, city, tag..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="metric-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-3 font-medium text-muted-foreground">Name</th>
              <th className="pb-3 font-medium text-muted-foreground">Phone</th>
              <th className="pb-3 font-medium text-muted-foreground">Email</th>
              <th className="pb-3 font-medium text-muted-foreground">City</th>
              <th className="pb-3 font-medium text-muted-foreground">Tags</th>
              <th className="pb-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/admin/customers/${c.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/admin/customers/${c.id}`);
                  }
                }}
                className="border-b last:border-0 cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <td className="py-3 font-medium">
                  <Link
                    to={`/admin/customers/${c.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-primary hover:underline"
                  >
                    {c.name}
                  </Link>
                </td>
                <td className="py-3 text-muted-foreground">{c.phone}</td>
                <td className="py-3 text-muted-foreground">{c.email}</td>
                <td className="py-3">{c.serviceAddress.city}</td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <span key={t} className="status-badge bg-primary/10 text-primary">{t}</span>
                    ))}
                  </div>
                </td>
                <td className="py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <Link to={`/admin/customers/${c.id}`}>
                      <Button size="sm" variant="ghost" title="View"><Eye className="h-4 w-4" /></Button>
                    </Link>
                    <Link to={`/admin/customers/${c.id}/edit`}>
                      <Button size="sm" variant="ghost" title="Edit"><Pencil className="h-4 w-4" /></Button>
                    </Link>
                    <Button size="sm" variant="ghost" title="Archive" onClick={() => archiveMutation.mutate(c.id)}>
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
