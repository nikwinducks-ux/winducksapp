import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef } from "react";
import type { Address, Customer, CustomerProperty, CustomerContact, ServiceProvider, Job, JobService, AllocationScores } from "@/data/mockData";

// ===== Type mappers =====

function dbPropertyToCustomerProperty(row: any): CustomerProperty {
  return {
    id: row.id,
    customerId: row.customer_id,
    label: row.label ?? "",
    isPrimary: !!row.is_primary,
    address: {
      street: row.address_street ?? "",
      city: row.address_city ?? "",
      province: row.address_region ?? "",
      postalCode: row.address_postal ?? "",
      country: row.address_country ?? "Canada",
      lat: row.address_lat ?? undefined,
      lng: row.address_lng ?? undefined,
    },
    notes: row.notes ?? "",
    displayOrder: row.display_order ?? 0,
  };
}

function dbContactToCustomerContact(row: any): CustomerContact {
  return {
    id: row.id,
    customerId: row.customer_id,
    name: row.name ?? "",
    role: row.role ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    isPrimary: !!row.is_primary,
    displayOrder: row.display_order ?? 0,
  };
}

function dbToCustomer(row: any, properties: CustomerProperty[] = [], contacts: CustomerContact[] = []): Customer {
  return {
    id: row.id,
    name: row.name,
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    companyName: row.company_name ?? "",
    displayAs: (row.display_as ?? "person") as "person" | "company",
    phone: row.phone,
    email: row.email,
    serviceAddress: {
      street: row.address_street,
      city: row.address_city,
      province: row.address_region,
      postalCode: row.address_postal,
      country: row.address_country,
      lat: row.address_lat ?? undefined,
      lng: row.address_lng ?? undefined,
    },
    properties,
    contacts,
    notes: row.notes,
    tags: row.tags ?? [],
    archived: row.status === "Archived",
    lastJobDate: undefined,
  };
}

function dbToSP(row: any): ServiceProvider {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    avatar: row.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase(),
    status: row.status as "Active" | "Suspended",
    baseAddress: {
      street: row.base_address_street,
      city: row.base_address_city,
      province: row.base_address_region,
      postalCode: row.base_address_postal,
      country: row.base_address_country,
      lat: row.base_lat ?? undefined,
      lng: row.base_lng ?? undefined,
    },
    rating: Number(row.rating),
    reliabilityScore: row.reliability_score,
    completionRate: row.completion_rate,
    onTimeRate: row.on_time_rate,
    cancellationRate: row.cancellation_rate,
    acceptanceRate: row.acceptance_rate,
    avgResponseTime: row.avg_response_time,
    fairnessShare: row.fairness_share,
    fairnessStatus: row.fairness_status as any,
    complianceStatus: row.compliance_status as any,
    insuranceExpiry: row.insurance_expiry ?? "",
    certifications: row.certifications ?? [],
    serviceCategories: row.categories ?? [],
    maxJobsPerDay: row.max_jobs_per_day,
    travelRadius: row.service_radius_km,
    autoAccept: row.auto_accept,
    joinedDate: row.joined_date ?? "",
    totalJobsCompleted: row.total_jobs_completed,
    notes: row.notes,
    archived: row.status === "Archived",
    calendarColor: row.calendar_color ?? null,
  };
}

function dbToJob(row: any, customers: Customer[]): Job {
  const cust = customers.find((c) => c.id === row.customer_id);
  // If customers haven't loaded yet (or RLS hides the row), fall back to the
  // job's own city so SPs see a useful label instead of "Unknown".
  const fallbackName = row.customer_id
    ? (row.job_address_city ? `Customer · ${row.job_address_city}` : "Loading…")
    : "—";
  return {
    id: row.job_number || row.id,
    dbId: row.id,
    customerId: row.customer_id ?? "",
    customerName: cust?.name ?? fallbackName,
    address: `${row.job_address_street}, ${row.job_address_city}`,
    jobAddress: {
      street: row.job_address_street,
      city: row.job_address_city,
      province: row.job_address_region,
      postalCode: row.job_address_postal,
      country: row.job_address_country,
      lat: row.job_lat ?? undefined,
      lng: row.job_lng ?? undefined,
    },
    serviceCategory: row.service_category,
    estimatedDuration: row.estimated_duration,
    scheduledDate: row.scheduled_date ?? "",
    scheduledTime: row.scheduled_time,
    payout: Number(row.payout),
    status: row.status as any,
    assignedSpId: row.assigned_sp_id ?? undefined,
    scores: row.scores as AllocationScores | undefined,
    notes: row.notes ?? "",
    urgency: row.urgency ?? "Scheduled",
    isBroadcast: row.is_broadcast ?? false,
    broadcastRadiusKm: row.broadcast_radius_km ?? 100,
    broadcastNote: row.broadcast_note ?? "",
    completedAt: row.completed_at ?? undefined,
    crew: [],
    payoutShare: Number(row.payout),
  };
}

// ===== Service Categories =====

export interface ServiceCategory {
  id: string;
  name: string;
  code: string;
  description: string;
  active: boolean;
  display_order: number;
}

export function useServiceCategories() {
  return useQuery({
    queryKey: ["service_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_categories")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ServiceCategory[];
    },
  });
}

export function useActiveServiceCategories() {
  const { data: all = [] } = useServiceCategories();
  return all.filter((c) => c.active);
}

export function useCreateServiceCategory() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (form: { name: string; code?: string; description: string; display_order: number }) => {
      const { error } = await supabase.from("service_categories").insert(form);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service_categories"] });
      toast({ title: "Category created" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateServiceCategory() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...fields }: { id: string; name?: string; code?: string; description?: string; active?: boolean; display_order?: number }) => {
      const { error } = await supabase.from("service_categories").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service_categories"] });
      toast({ title: "Category updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

// ===== Service Category Line Items =====

export interface ServiceCategoryLineItem {
  id: string;
  category_id: string;
  title: string;
  description: string;
  price: number;
  display_order: number;
  active: boolean;
}

export function useCategoryLineItems(categoryId: string | undefined) {
  return useQuery({
    queryKey: ["service_category_line_items", categoryId],
    queryFn: async () => {
      if (!categoryId) return [];
      const { data, error } = await supabase
        .from("service_category_line_items" as any)
        .select("*")
        .eq("category_id", categoryId)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ServiceCategoryLineItem[];
    },
    enabled: !!categoryId,
  });
}

export function useCreateLineItem() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (form: { category_id: string; title: string; description?: string; price: number; display_order?: number }) => {
      const { error } = await supabase.from("service_category_line_items" as any).insert(form);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["service_category_line_items", vars.category_id] });
      toast({ title: "Line item added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
}

export function useUpdateLineItem() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, category_id, ...fields }: { id: string; category_id: string; title?: string; description?: string; price?: number; active?: boolean; display_order?: number }) => {
      const { error } = await supabase.from("service_category_line_items" as any).update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["service_category_line_items", vars.category_id] });
      toast({ title: "Line item updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
}

export function useDeleteLineItem() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, category_id }: { id: string; category_id: string }) => {
      const { error } = await supabase.from("service_category_line_items" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["service_category_line_items", vars.category_id] });
      toast({ title: "Line item deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
}

// ===== Hooks =====

export function useCustomers() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const ids = rows.map((r: any) => r.id);
      let propsByCust: Record<string, CustomerProperty[]> = {};
      let contactsByCust: Record<string, CustomerContact[]> = {};
      if (ids.length > 0) {
        const [{ data: pData }, { data: cData }] = await Promise.all([
          supabase.from("customer_properties").select("*").in("customer_id", ids).order("display_order", { ascending: true }),
          supabase.from("customer_contacts").select("*").in("customer_id", ids).order("display_order", { ascending: true }),
        ]);
        for (const p of (pData ?? []) as any[]) {
          if (!propsByCust[p.customer_id]) propsByCust[p.customer_id] = [];
          propsByCust[p.customer_id].push(dbPropertyToCustomerProperty(p));
        }
        for (const c of (cData ?? []) as any[]) {
          if (!contactsByCust[c.customer_id]) contactsByCust[c.customer_id] = [];
          contactsByCust[c.customer_id].push(dbContactToCustomerContact(c));
        }
      }
      return rows.map((r: any) => dbToCustomer(r, propsByCust[r.id] ?? [], contactsByCust[r.id] ?? []));
    },
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ["customers", id],
    queryFn: async () => {
      if (!id) return null;
      const [{ data, error }, { data: pData }, { data: cData }] = await Promise.all([
        supabase.from("customers").select("*").eq("id", id).single(),
        supabase.from("customer_properties").select("*").eq("customer_id", id).order("display_order", { ascending: true }),
        supabase.from("customer_contacts").select("*").eq("customer_id", id).order("display_order", { ascending: true }),
      ]);
      if (error) throw error;
      const properties = (pData ?? []).map(dbPropertyToCustomerProperty);
      const contacts = (cData ?? []).map(dbContactToCustomerContact);
      return dbToCustomer(data, properties, contacts);
    },
    enabled: !!id,
  });
}

export function useServiceProviders() {
  return useQuery({
    queryKey: ["service_providers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_providers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToSP);
    },
  });
}

export function useServiceProvider(id: string | undefined) {
  return useQuery({
    queryKey: ["service_providers", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from("service_providers").select("*").eq("id", id).single();
      if (error) throw error;
      return dbToSP(data);
    },
    enabled: !!id,
  });
}

export function useJobs() {
  // Customers are fetched in parallel; their names are merged in via the
  // `select` transform below so jobs are NEVER blocked on customers loading.
  const { data: customers = [] } = useCustomers();

  return useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .order("scheduled_date", { ascending: true });
      if (error) {
        console.error("[useJobs] jobs query failed", error);
        throw error;
      }
      console.log("[useJobs] fetched", (data ?? []).length, "jobs");
      const jobIds = (data ?? []).map((r: any) => r.id);
      let servicesMap: Record<string, JobService[]> = {};
      let crewMap: Record<string, { spId: string; isLead: boolean }[]> = {};
      if (jobIds.length > 0) {
        const [{ data: svcData }, { data: crewData }] = await Promise.all([
          supabase.from("job_services").select("*").in("job_id", jobIds),
          supabase.from("job_crew_members" as any).select("job_id, sp_id, is_lead, added_at").in("job_id", jobIds).order("added_at", { ascending: true }),
        ]);
        for (const svc of (svcData ?? []) as any[]) {
          if (!servicesMap[svc.job_id]) servicesMap[svc.job_id] = [];
          servicesMap[svc.job_id].push({
            id: svc.id,
            job_id: svc.job_id,
            service_category: svc.service_category,
            quantity: svc.quantity,
            unit_price: svc.unit_price != null ? Number(svc.unit_price) : null,
            line_total: Number(svc.line_total),
            notes: svc.notes ?? "",
          });
        }
        for (const c of (crewData ?? []) as any[]) {
          if (!crewMap[c.job_id]) crewMap[c.job_id] = [];
          crewMap[c.job_id].push({ spId: c.sp_id, isLead: c.is_lead });
        }
      }
      // Stash raw rows + maps so the select transform can re-apply customer
      // names whenever the customers query updates.
      return { rows: data ?? [], servicesMap, crewMap };
    },
    select: ({ rows, servicesMap, crewMap }) => {
      return rows.map((r: any) => {
        const job = dbToJob(r, customers);
        job.services = servicesMap[r.id] ?? [];
        job.crew = crewMap[r.id] ?? [];
        const n = job.crew.length || 1;
        job.payoutShare = Math.round((job.payout / n) * 100) / 100;
        return job;
      });
    },
  });
}

// ===== Job Services =====

export function useJobServices(jobId: string | undefined) {
  return useQuery({
    queryKey: ["job_services", jobId],
    queryFn: async () => {
      if (!jobId) return [];
      const { data, error } = await supabase
        .from("job_services")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((svc: any) => ({
        id: svc.id,
        job_id: svc.job_id,
        service_category: svc.service_category,
        quantity: svc.quantity,
        unit_price: svc.unit_price != null ? Number(svc.unit_price) : null,
        line_total: Number(svc.line_total),
        notes: svc.notes ?? "",
      })) as JobService[];
    },
    enabled: !!jobId,
  });
}

export function useSaveJobServices() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ jobId, services }: {
      jobId: string;
      services: { service_category: string; quantity: number; unit_price: number | null; line_total: number; notes: string }[];
    }) => {
      // Delete all existing services for job, then re-insert
      const { error: delErr } = await supabase.from("job_services").delete().eq("job_id", jobId);
      if (delErr) throw delErr;
      if (services.length > 0) {
        const rows = services.map(s => ({ job_id: jobId, ...s }));
        const { error: insErr } = await supabase.from("job_services").insert(rows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job_services"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (err: any) => {
      toast({ title: "Error saving services", description: err.message, variant: "destructive" });
    },
  });
}

// ===== Job Photos =====

export interface JobPhoto {
  id: string;
  job_id: string;
  storage_path: string;
  caption: string;
  uploaded_by_user_id: string | null;
  created_at: string;
}

export function useJobPhotos(jobId: string | undefined) {
  return useQuery({
    queryKey: ["job_photos", jobId],
    queryFn: async () => {
      if (!jobId) return [];
      const { data, error } = await supabase
        .from("job_photos")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as JobPhoto[];
    },
    enabled: !!jobId,
  });
}

export function useSaveJobPhotos() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({
      jobId,
      newFiles,
      newCaptions,
      keepIds,
      existing,
      updatedCaptions,
    }: {
      jobId: string;
      newFiles: File[];
      newCaptions: string[];
      keepIds: string[];
      existing: JobPhoto[];
      updatedCaptions: Record<string, string>;
    }) => {
      // Delete photos that were removed
      const toDelete = existing.filter((p) => !keepIds.includes(p.id));
      if (toDelete.length > 0) {
        const paths = toDelete.map((p) => p.storage_path);
        await supabase.storage.from("job-photos").remove(paths);
        const ids = toDelete.map((p) => p.id);
        const { error: delErr } = await supabase.from("job_photos").delete().in("id", ids);
        if (delErr) throw delErr;
      }

      // Update captions on kept photos
      for (const p of existing) {
        if (keepIds.includes(p.id) && updatedCaptions[p.id] !== undefined && updatedCaptions[p.id] !== p.caption) {
          const { error } = await supabase
            .from("job_photos")
            .update({ caption: updatedCaptions[p.id] })
            .eq("id", p.id);
          if (error) throw error;
        }
      }

      // Upload new files
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      for (let i = 0; i < newFiles.length; i++) {
        const file = newFiles[i];
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${jobId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("job-photos")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("job_photos").insert({
          job_id: jobId,
          storage_path: path,
          caption: newCaptions[i] ?? "",
          uploaded_by_user_id: uid,
        });
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job_photos"] });
    },
    onError: (err: any) => {
      toast({ title: "Error saving photos", description: err.message, variant: "destructive" });
    },
  });
}

export function getJobPhotoUrl(storage_path: string): string {
  const { data } = supabase.storage.from("job-photos").getPublicUrl(storage_path);
  return data.publicUrl;
}

// ===== Mutations =====

export interface CustomerFormProperty {
  id?: string;
  label: string;
  isPrimary: boolean;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  lat: string;
  lng: string;
  notes: string;
}

export interface CustomerFormContact {
  id?: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  isPrimary: boolean;
}

export interface CustomerFormPayload {
  firstName: string;
  lastName: string;
  companyName: string;
  displayAs: "person" | "company";
  email: string;
  phone: string;
  notes: string;
  tags: string[];
  properties: CustomerFormProperty[];
  contacts: CustomerFormContact[];
}

function normalizeProperties(props: CustomerFormProperty[]): CustomerFormProperty[] {
  if (props.length === 0) return [];
  const hasPrimary = props.some((p) => p.isPrimary);
  return props.map((p, i) => ({
    ...p,
    label: p.label || (i === 0 ? "Primary" : `Property ${i + 1}`),
    isPrimary: hasPrimary ? p.isPrimary : i === 0,
  }));
}

function normalizeContacts(contacts: CustomerFormContact[]): CustomerFormContact[] {
  if (contacts.length === 0) return [];
  const hasPrimary = contacts.some((c) => c.isPrimary);
  return contacts.map((c, i) => ({
    ...c,
    isPrimary: hasPrimary ? c.isPrimary : i === 0,
  }));
}

async function replaceCustomerProperties(customerId: string, props: CustomerFormProperty[]) {
  // Delete existing then insert. The trigger will sync the legacy address columns.
  await supabase.from("customer_properties").delete().eq("customer_id", customerId);
  const normalized = normalizeProperties(props);
  if (normalized.length === 0) return;
  const rows = normalized.map((p, i) => ({
    customer_id: customerId,
    label: p.label,
    is_primary: p.isPrimary,
    address_street: p.street,
    address_city: p.city,
    address_region: p.province,
    address_postal: p.postalCode,
    address_country: p.country || "Canada",
    address_lat: p.lat ? parseFloat(p.lat) : null,
    address_lng: p.lng ? parseFloat(p.lng) : null,
    notes: p.notes,
    display_order: i,
  }));
  const { error } = await supabase.from("customer_properties").insert(rows);
  if (error) throw error;
}

async function replaceCustomerContacts(customerId: string, contacts: CustomerFormContact[]) {
  await supabase.from("customer_contacts").delete().eq("customer_id", customerId);
  const normalized = normalizeContacts(contacts);
  if (normalized.length === 0) return;
  const rows = normalized.map((c, i) => ({
    customer_id: customerId,
    name: c.name,
    role: c.role,
    phone: c.phone,
    email: c.email,
    is_primary: c.isPrimary,
    display_order: i,
  }));
  const { error } = await supabase.from("customer_contacts").insert(rows);
  if (error) throw error;
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (form: CustomerFormPayload) => {
      const { data, error } = await supabase.from("customers").insert({
        name: "", // sync trigger will fill from first/last/company
        first_name: form.firstName,
        last_name: form.lastName,
        company_name: form.companyName,
        display_as: form.displayAs,
        email: form.email,
        phone: form.phone,
        notes: form.notes,
        tags: form.tags,
        status: "Active",
      }).select("id").single();
      if (error) throw error;
      const newId = data!.id as string;
      await replaceCustomerProperties(newId, form.properties);
      await replaceCustomerContacts(newId, form.contacts);
      return newId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "Customer created", description: "Customer has been saved." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...form }: { id: string } & CustomerFormPayload) => {
      const { error } = await supabase.from("customers").update({
        first_name: form.firstName,
        last_name: form.lastName,
        company_name: form.companyName,
        display_as: form.displayAs,
        email: form.email,
        phone: form.phone,
        notes: form.notes,
        tags: form.tags,
      }).eq("id", id);
      if (error) throw error;
      await replaceCustomerProperties(id, form.properties);
      await replaceCustomerContacts(id, form.contacts);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customers", vars.id] });
      toast({ title: "Customer updated", description: "Changes saved." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

// ===== Customer Tags Catalog =====

export interface CustomerTag {
  id: string;
  name: string;
  color: string;
  display_order: number;
}

export const TAG_COLOR_OPTIONS: { value: string; label: string; className: string }[] = [
  { value: "primary", label: "Blue", className: "bg-primary/10 text-primary border-primary/30" },
  { value: "accent", label: "Orange", className: "bg-accent/10 text-accent-foreground border-accent/30" },
  { value: "success", label: "Green", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  { value: "warning", label: "Yellow", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  { value: "destructive", label: "Red", className: "bg-destructive/10 text-destructive border-destructive/30" },
  { value: "neutral", label: "Gray", className: "bg-secondary text-secondary-foreground border-border" },
];

export function tagColorClass(color: string | undefined): string {
  return TAG_COLOR_OPTIONS.find((o) => o.value === color)?.className ?? TAG_COLOR_OPTIONS[0].className;
}

export function useCustomerTags() {
  return useQuery({
    queryKey: ["customer_tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_tags")
        .select("*")
        .order("display_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CustomerTag[];
    },
  });
}

export function useCreateCustomerTag() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (form: { name: string; color: string; display_order?: number }) => {
      const { data, error } = await supabase.from("customer_tags").insert(form).select("*").single();
      if (error) throw error;
      return data as CustomerTag;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer_tags"] });
      toast({ title: "Tag created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
}

export function useUpdateCustomerTag() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...fields }: { id: string; name?: string; color?: string; display_order?: number }) => {
      const { error } = await supabase.from("customer_tags").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer_tags"] });
      toast({ title: "Tag updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
}

export function useDeleteCustomerTag() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customer_tags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer_tags"] });
      toast({ title: "Tag deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
}


export function useArchiveCustomer() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").update({ status: "Archived" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "Customer archived" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useCreateSP() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (form: {
      name: string; email: string; phone: string; status: string;
      street: string; city: string; province: string; postalCode: string; country: string;
      lat: string; lng: string; travelRadius: string; maxJobsPerDay: string;
      notes: string; categories: string[]; calendarColor?: string | null;
    }) => {
      const { error } = await supabase.from("service_providers").insert({
        name: form.name, email: form.email, phone: form.phone, status: form.status,
        base_address_street: form.street, base_address_city: form.city, base_address_region: form.province,
        base_address_postal: form.postalCode, base_address_country: form.country,
        base_lat: form.lat ? parseFloat(form.lat) : null,
        base_lng: form.lng ? parseFloat(form.lng) : null,
        service_radius_km: parseInt(form.travelRadius) || 30,
        max_jobs_per_day: parseInt(form.maxJobsPerDay) || 5,
        notes: form.notes, categories: form.categories,
        calendar_color: form.calendarColor ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service_providers"] });
      toast({ title: "Provider created", description: "Service provider has been saved." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateSP() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...form }: {
      id: string; name: string; email: string; phone: string; status: string;
      street: string; city: string; province: string; postalCode: string; country: string;
      lat: string; lng: string; travelRadius: string; maxJobsPerDay: string;
      notes: string; categories: string[]; calendarColor?: string | null;
    }) => {
      const { error } = await supabase.from("service_providers").update({
        name: form.name, email: form.email, phone: form.phone, status: form.status,
        base_address_street: form.street, base_address_city: form.city, base_address_region: form.province,
        base_address_postal: form.postalCode, base_address_country: form.country,
        base_lat: form.lat ? parseFloat(form.lat) : null,
        base_lng: form.lng ? parseFloat(form.lng) : null,
        service_radius_km: parseInt(form.travelRadius) || 30,
        max_jobs_per_day: parseInt(form.maxJobsPerDay) || 5,
        notes: form.notes, categories: form.categories,
        calendar_color: form.calendarColor ?? null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service_providers"] });
      toast({ title: "Provider updated", description: "Changes saved." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateSPColor() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, color }: { id: string; color: string | null }) => {
      const { error } = await supabase
        .from("service_providers")
        .update({ calendar_color: color })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service_providers"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useToggleSPStatus() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("service_providers").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service_providers"] });
      toast({ title: "Status updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useArchiveSP() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_providers").update({ status: "Archived" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service_providers"] });
      toast({ title: "Provider archived" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useRestoreSP() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_providers").update({ status: "Active" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service_providers"] });
      toast({ title: "Provider restored" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

// ===== Job Mutations =====

export function useCreateJob() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (form: {
      customerId: string; serviceCategory: string; payout: string;
      street: string; city: string; province: string; postalCode: string; country: string;
      lat: string; lng: string; scheduledDate: string; scheduledTime: string; estimatedDuration: string;
      notes?: string; urgency?: string;
    }) => {
      // job_number is auto-assigned by DB trigger (assign_job_number)
      const { error } = await supabase.from("jobs").insert({
        customer_id: form.customerId || null,
        service_category: form.serviceCategory,
        payout: parseFloat(form.payout) || 0,
        job_address_street: form.street,
        job_address_city: form.city,
        job_address_region: form.province,
        job_address_postal: form.postalCode,
        job_address_country: form.country,
        job_lat: form.lat ? parseFloat(form.lat) : null,
        job_lng: form.lng ? parseFloat(form.lng) : null,
        scheduled_date: form.scheduledDate || null,
        scheduled_time: form.scheduledTime,
        estimated_duration: form.estimatedDuration,
        notes: form.notes ?? "",
        urgency: form.urgency ?? "Scheduled",
        is_broadcast: (form as any).isBroadcast ?? false,
        broadcast_radius_km: (form as any).broadcastRadiusKm ?? 100,
        broadcast_note: (form as any).broadcastNote ?? "",
        status: "Created",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast({ title: "Job created", description: "Job has been saved." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateJob() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...form }: {
      id: string; customerId: string; serviceCategory: string; payout: string;
      street: string; city: string; province: string; postalCode: string; country: string;
      lat: string; lng: string; scheduledDate: string; scheduledTime: string; estimatedDuration: string;
      notes?: string; urgency?: string;
    }) => {
      const { error } = await supabase.from("jobs").update({
        customer_id: form.customerId || null,
        service_category: form.serviceCategory,
        payout: parseFloat(form.payout) || 0,
        job_address_street: form.street,
        job_address_city: form.city,
        job_address_region: form.province,
        job_address_postal: form.postalCode,
        job_address_country: form.country,
        job_lat: form.lat ? parseFloat(form.lat) : null,
        job_lng: form.lng ? parseFloat(form.lng) : null,
        scheduled_date: form.scheduledDate || null,
        scheduled_time: form.scheduledTime,
        estimated_duration: form.estimatedDuration,
        notes: form.notes ?? "",
        urgency: form.urgency ?? "Scheduled",
        is_broadcast: (form as any).isBroadcast ?? false,
        broadcast_radius_km: (form as any).broadcastRadiusKm ?? 100,
        broadcast_note: (form as any).broadcastNote ?? "",
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast({ title: "Job updated", description: "Changes saved." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useAssignJob() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ jobId, spId, assignedByUserId, spIds, leadSpId }: {
      jobId: string;
      spId?: string;
      assignedByUserId: string | null;
      spIds?: string[];
      leadSpId?: string;
    }) => {
      // Support both legacy single-SP call (spId) and crew (spIds)
      const ids = spIds && spIds.length > 0 ? spIds : (spId ? [spId] : []);
      if (ids.length === 0) throw new Error("No SP selected");
      const lead = leadSpId && ids.includes(leadSpId) ? leadSpId : ids[0];

      // Replace any existing crew for this job
      const { error: delErr } = await supabase
        .from("job_crew_members" as any)
        .delete()
        .eq("job_id", jobId);
      if (delErr) throw delErr;

      const rows = ids.map((sp_id) => ({
        job_id: jobId,
        sp_id,
        is_lead: sp_id === lead,
        added_by_user_id: assignedByUserId,
      }));
      const { error: insErr } = await supabase.from("job_crew_members" as any).insert(rows);
      if (insErr) throw insErr;

      // Audit each assignment
      const auditRows = ids.map((sp_id) => ({
        job_id: jobId,
        sp_id,
        assigned_by_user_id: assignedByUserId,
        assignment_type: "Manual",
      }));
      const { error: auditErr } = await supabase.from("job_assignments").insert(auditRows);
      if (auditErr) console.error("Assignment audit error:", auditErr);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["job_crew", undefined] });
      toast({ title: "Crew assigned", description: "Job crew has been updated." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useUnassignJob() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ jobDbId, userId }: { jobDbId: string; userId: string | null }) => {
      const { data: jobRow, error: fetchErr } = await supabase
        .from("jobs")
        .select("id, status, assigned_sp_id")
        .eq("id", jobDbId)
        .single();
      if (fetchErr) throw fetchErr;
      if (!jobRow.assigned_sp_id) throw new Error("Job is not assigned.");

      // Clear all crew members; trigger will reset assigned_sp_id and status to Created
      const { error: delErr } = await supabase
        .from("job_crew_members" as any)
        .delete()
        .eq("job_id", jobDbId);
      if (delErr) throw delErr;

      // Cancel any pending offers
      await supabase.from("offers")
        .update({ status: "Cancelled", responded_at: new Date().toISOString() })
        .eq("job_id", jobDbId)
        .eq("status", "Pending");

      // Audit
      await supabase.from("job_status_events").insert({
        job_id: jobDbId,
        old_status: jobRow.status,
        new_status: "Created",
        changed_by_user_id: userId,
        note: "Unassigned by admin",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["offers"] });
      toast({ title: "SP unassigned", description: "Job returned to Created." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useAcceptJobOffer() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ jobDbId, spId }: { jobDbId: string; spId: string }) => {
      // 1. Check job is still available
      const { data: jobRow, error: fetchErr } = await supabase
        .from("jobs")
        .select("id, status, assigned_sp_id")
        .eq("id", jobDbId)
        .single();
      if (fetchErr) throw new Error("Could not verify job availability.");
      if (jobRow.assigned_sp_id) throw new Error("Job already assigned to another provider.");
      const st = (jobRow.status || "").toLowerCase().replace(/\s/g, "-");
      if (!["created", "pending", "offered"].includes(st)) {
        throw new Error(`Job is no longer available (status: ${jobRow.status}).`);
      }

      // 2. Insert crew member (lead). Trigger updates jobs.assigned_sp_id + status.
      const { error: crewErr } = await supabase.from("job_crew_members" as any).insert({
        job_id: jobDbId,
        sp_id: spId,
        is_lead: true,
      });
      if (crewErr) throw new Error("Failed to accept job. It may have been taken.");

      // 3. Insert assignment audit
      const { error: assignErr } = await supabase.from("job_assignments").insert({
        job_id: jobDbId,
        sp_id: spId,
        assignment_type: "Offer",
      });
      if (assignErr) console.error("Assignment audit error:", assignErr);

      // 4. Insert status event audit
      await supabase.from("job_status_events").insert({
        job_id: jobDbId,
        old_status: jobRow.status,
        new_status: "Assigned",
        changed_by_sp_id: spId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast({ title: "Job accepted", description: "Job accepted and added to My Jobs." });
    },
    onError: (err: any) => {
      toast({ title: "Could not accept job", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (jobDbId: string) => {
      const { data, error } = await supabase.rpc("delete_job" as any, { _job_id: jobDbId });
      if (error) throw error;
      const result = data as any;
      if (result?.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["offers"] });
      qc.invalidateQueries({ queryKey: ["job-photos"] });
      qc.invalidateQueries({ queryKey: ["job-services"] });
      qc.invalidateQueries({ queryKey: ["allocation-runs"] });
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });
}

export function useStopBroadcast() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (jobDbId: string) => {
      const { data, error } = await supabase.rpc("stop_broadcast" as any, { _job_id: jobDbId });
      if (error) throw error;
      const result = data as any;
      if (result?.error) throw new Error(result.error);
      return result as { success: true; cancelled_offer_count: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["offers"] });
    },
    onError: (err: any) => {
      toast({ title: "Stop broadcast failed", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateJobStatus() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ jobDbId, oldStatus, newStatus, spId, userId, note }: {
      jobDbId: string; oldStatus: string; newStatus: string;
      spId?: string; userId?: string; note?: string;
    }) => {
      // Update job status — trigger enforces column-level security for SPs
      const { error: jobErr } = await supabase.from("jobs")
        .update({ status: newStatus })
        .eq("id", jobDbId);
      if (jobErr) throw jobErr;

      // Insert audit event
      const { error: eventErr } = await supabase.from("job_status_events").insert({
        job_id: jobDbId,
        old_status: oldStatus,
        new_status: newStatus,
        changed_by_sp_id: spId ?? null,
        changed_by_user_id: userId ?? null,
        note: note ?? null,
      });
      if (eventErr) console.error("Status event audit error:", eventErr);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast({ title: "Status updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error updating status", description: err.message, variant: "destructive" });
    },
  });
}

// ===== Job Crew =====

export interface JobCrewMember {
  id: string;
  jobId: string;
  spId: string;
  isLead: boolean;
  addedAt: string;
}

export function useJobCrew(jobId: string | undefined) {
  return useQuery({
    queryKey: ["job_crew", jobId],
    queryFn: async () => {
      if (!jobId) return [];
      const { data, error } = await supabase
        .from("job_crew_members" as any)
        .select("*")
        .eq("job_id", jobId)
        .order("added_at", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        id: r.id, jobId: r.job_id, spId: r.sp_id, isLead: r.is_lead, addedAt: r.added_at,
      })) as JobCrewMember[];
    },
    enabled: !!jobId,
  });
}

export function useAddCrewMember() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ jobId, spId, userId }: { jobId: string; spId: string; userId: string | null }) => {
      const { error } = await supabase.from("job_crew_members" as any).insert({
        job_id: jobId, sp_id: spId, is_lead: false, added_by_user_id: userId,
      });
      if (error) throw error;
      await supabase.from("job_assignments").insert({
        job_id: jobId, sp_id: spId, assigned_by_user_id: userId, assignment_type: "Manual",
      });
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["job_crew", v.jobId] });
      toast({ title: "Crew member added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
}

export function useRemoveCrewMember() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ jobId, spId }: { jobId: string; spId: string }) => {
      const { error } = await supabase
        .from("job_crew_members" as any)
        .delete()
        .eq("job_id", jobId)
        .eq("sp_id", spId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["job_crew", v.jobId] });
      toast({ title: "Crew member removed" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
}

export function useSetCrewLead() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ jobId, spId }: { jobId: string; spId: string }) => {
      const { error: clearErr } = await supabase
        .from("job_crew_members" as any)
        .update({ is_lead: false })
        .eq("job_id", jobId);
      if (clearErr) throw clearErr;
      const { error } = await supabase
        .from("job_crew_members" as any)
        .update({ is_lead: true })
        .eq("job_id", jobId)
        .eq("sp_id", spId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["job_crew", v.jobId] });
      toast({ title: "Lead updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
}

/**
 * Diff-based crew assignment. Reads existing crew, computes insert/delete/lead-update,
 * applies in a batch, and cancels pending offers when first members are added.
 */
export function useAssignCrew() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ jobId, members, userId }: {
      jobId: string;
      members: { spId: string; isLead: boolean }[];
      userId: string | null;
    }) => {
      // Fetch existing crew
      const { data: existingRaw, error: fetchErr } = await supabase
        .from("job_crew_members" as any)
        .select("id, sp_id, is_lead")
        .eq("job_id", jobId);
      if (fetchErr) throw fetchErr;
      const existing = (existingRaw ?? []) as any[];

      const incomingIds = new Set(members.map((m) => m.spId));
      const existingIds = new Set(existing.map((r) => r.sp_id));

      const toInsert = members.filter((m) => !existingIds.has(m.spId));
      const toDelete = existing.filter((r) => !incomingIds.has(r.sp_id));

      // Determine lead — prefer flagged, else first incoming member
      const desiredLead =
        members.find((m) => m.isLead)?.spId ?? members[0]?.spId ?? null;

      // Cancel pending offers when transitioning from empty -> non-empty
      const wasEmpty = existing.length === 0;
      if (wasEmpty && members.length > 0) {
        await supabase
          .from("offers")
          .update({ status: "Cancelled", responded_at: new Date().toISOString() } as any)
          .eq("job_id", jobId)
          .eq("status", "Pending");
      }

      // Delete removed members
      if (toDelete.length > 0) {
        const { error: delErr } = await supabase
          .from("job_crew_members" as any)
          .delete()
          .in("id", toDelete.map((r) => r.id));
        if (delErr) throw delErr;
      }

      // Insert new members
      if (toInsert.length > 0) {
        const rows = toInsert.map((m) => ({
          job_id: jobId,
          sp_id: m.spId,
          is_lead: m.spId === desiredLead,
          added_by_user_id: userId,
        }));
        const { error: insErr } = await supabase
          .from("job_crew_members" as any)
          .insert(rows);
        if (insErr) throw insErr;

        // Audit
        const auditRows = toInsert.map((m) => ({
          job_id: jobId,
          sp_id: m.spId,
          assigned_by_user_id: userId,
          assignment_type: "Manual",
        }));
        await supabase.from("job_assignments").insert(auditRows);
      }

      // Sync lead flag for any kept rows whose lead status changed
      if (desiredLead && members.length > 0) {
        // Clear all leads for this job, then set the desired one
        await supabase
          .from("job_crew_members" as any)
          .update({ is_lead: false })
          .eq("job_id", jobId);
        await supabase
          .from("job_crew_members" as any)
          .update({ is_lead: true })
          .eq("job_id", jobId)
          .eq("sp_id", desiredLead);
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["job_crew", v.jobId] });
      qc.invalidateQueries({ queryKey: ["offers"] });
    },
    onError: (err: any) => {
      toast({ title: "Crew save failed", description: err.message, variant: "destructive" });
    },
  });
}

// ===== Seeding =====

export function useSeedData() {
  const qc = useQueryClient();
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;

    (async () => {
      // Check if data already exists
      const { count: custCount } = await supabase.from("customers").select("*", { count: "exact", head: true });
      const { count: spCount } = await supabase.from("service_providers").select("*", { count: "exact", head: true });
      if ((custCount ?? 0) > 0 || (spCount ?? 0) > 0) return;

      // Seed customers
      const customerRows = [
        { name: "John Baker", phone: "(403) 555-1001", email: "john.baker@email.com", address_street: "123 Main St NW", address_city: "Calgary", address_region: "AB", address_postal: "T2M 1N5", address_country: "Canada", address_lat: 51.0677, address_lng: -114.084, notes: "Gate code: 4521. Two dogs in backyard.", tags: ["Recurring"] },
        { name: "Maria Santos", phone: "(403) 555-1002", email: "maria.santos@email.com", address_street: "456 Bow Trail SW", address_city: "Calgary", address_region: "AB", address_postal: "T3C 2G3", address_country: "Canada", address_lat: 51.043, address_lng: -114.11, notes: "Ring doorbell twice.", tags: ["VIP"] },
        { name: "Tom Henderson", phone: "(403) 555-1003", email: "tom.henderson@email.com", address_street: "789 Centre St N", address_city: "Calgary", address_region: "AB", address_postal: "T2E 2P9", address_country: "Canada", address_lat: 51.06, address_lng: -114.06, notes: "", tags: [] },
        { name: "Rachel Green", phone: "(403) 555-1004", email: "rachel.green@email.com", address_street: "321 17th Ave SW", address_city: "Calgary", address_region: "AB", address_postal: "T2S 0A5", address_country: "Canada", address_lat: 51.038, address_lng: -114.075, notes: "Park on street.", tags: ["Recurring"] },
        { name: "Alex Turner", phone: "(403) 555-1005", email: "alex.turner@email.com", address_street: "555 Macleod Trail SE", address_city: "Calgary", address_region: "AB", address_postal: "T2G 0A2", address_country: "Canada", address_lat: 51.04, address_lng: -114.062, notes: "", tags: [] },
        { name: "Diana Prince", phone: "(403) 555-1006", email: "diana.prince@email.com", address_street: "100 Crowfoot Way NW", address_city: "Calgary", address_region: "AB", address_postal: "T3G 4J2", address_country: "Canada", address_lat: 51.123, address_lng: -114.206, notes: "Access from back lane.", tags: ["VIP", "Recurring"] },
        { name: "Bruce Wayne", phone: "(403) 555-1007", email: "bruce.wayne@email.com", address_street: "900 Deerfoot Trail NE", address_city: "Calgary", address_region: "AB", address_postal: "T2A 5G6", address_country: "Canada", address_lat: 51.048, address_lng: -113.985, notes: "Large property, budget flexible.", tags: ["VIP"] },
        { name: "Clark Kent", phone: "(403) 555-1008", email: "clark.kent@email.com", address_street: "200 University Dr NW", address_city: "Calgary", address_region: "AB", address_postal: "T2N 1N4", address_country: "Canada", address_lat: 51.078, address_lng: -114.13, notes: "", tags: [] },
        { name: "Peter Parker", phone: "(403) 555-1009", email: "peter.parker@email.com", address_street: "750 9th Ave SE", address_city: "Calgary", address_region: "AB", address_postal: "T2G 0S3", address_country: "Canada", address_lat: 51.045, address_lng: -114.053, notes: "Buzzer #204.", tags: [] },
        { name: "Tony Stark", phone: "(403) 555-1010", email: "tony.stark@email.com", address_street: "500 4th St SW", address_city: "Calgary", address_region: "AB", address_postal: "T2P 2V6", address_country: "Canada", address_lat: 51.049, address_lng: -114.072, notes: "Underground parking access.", tags: ["VIP"] },
        { name: "Natasha Romanov", phone: "(403) 555-1011", email: "natasha.r@email.com", address_street: "310 Heritage Dr SE", address_city: "Calgary", address_region: "AB", address_postal: "T2H 1M6", address_country: "Canada", address_lat: 51.02, address_lng: -114.04, notes: "", tags: ["Recurring"] },
        { name: "Steve Rogers", phone: "(403) 555-1012", email: "steve.rogers@email.com", address_street: "888 Country Hills Blvd NE", address_city: "Calgary", address_region: "AB", address_postal: "T3K 5C3", address_country: "Canada", address_lat: 51.155, address_lng: -114.065, notes: "Three-storey home.", tags: [] },
        { name: "Wanda Maximoff", phone: "(403) 555-1013", email: "wanda.m@email.com", address_street: "425 Memorial Dr NE", address_city: "Calgary", address_region: "AB", address_postal: "T2E 4Y7", address_country: "Canada", address_lat: 51.052, address_lng: -114.045, notes: "", tags: [] },
        { name: "Sam Wilson", phone: "(403) 555-1014", email: "sam.wilson@email.com", address_street: "150 Shawnessy Blvd SW", address_city: "Calgary", address_region: "AB", address_postal: "T2Y 3S4", address_country: "Canada", address_lat: 50.908, address_lng: -114.068, notes: "Side gate unlocked.", tags: ["Recurring"] },
        { name: "Pepper Potts", phone: "(403) 555-1015", email: "pepper.potts@email.com", address_street: "290 52nd St SE", address_city: "Calgary", address_region: "AB", address_postal: "T2A 4R2", address_country: "Canada", address_lat: 51.039, address_lng: -113.97, notes: "", tags: [] },
        { name: "Happy Hogan", phone: "(403) 555-1016", email: "happy.hogan@email.com", address_street: "400 Beddington Blvd NE", address_city: "Calgary", address_region: "AB", address_postal: "T3K 2A8", address_country: "Canada", address_lat: 51.14, address_lng: -114.055, notes: "", tags: [] },
        { name: "Nick Fury", phone: "(403) 555-1017", email: "nick.fury@email.com", address_street: "50 Signal Hill Centre SW", address_city: "Calgary", address_region: "AB", address_postal: "T3H 3P8", address_country: "Canada", address_lat: 51.018, address_lng: -114.18, notes: "Use service entrance.", tags: ["VIP"] },
        { name: "Phil Coulson", phone: "(403) 555-1018", email: "phil.coulson@email.com", address_street: "725 Harvest Hills Dr NE", address_city: "Calgary", address_region: "AB", address_postal: "T3K 4W1", address_country: "Canada", address_lat: 51.165, address_lng: -114.048, notes: "", tags: [] },
        { name: "May Parker", phone: "(403) 555-1019", email: "may.parker@email.com", address_street: "180 Tuscany Blvd NW", address_city: "Calgary", address_region: "AB", address_postal: "T3L 2V4", address_country: "Canada", address_lat: 51.169, address_lng: -114.24, notes: "Older home, careful with siding.", tags: ["Recurring"] },
        { name: "Janet Van Dyne", phone: "(403) 555-1020", email: "janet.vd@email.com", address_street: "45 Main St", address_city: "Cochrane", address_region: "AB", address_postal: "T4C 1A5", address_country: "Canada", address_lat: 51.189, address_lng: -114.4663, notes: "Acreage property.", tags: ["VIP"] },
        { name: "Hank Pym", phone: "(403) 555-1021", email: "hank.pym@email.com", address_street: "120 East Lake Blvd", address_city: "Airdrie", address_region: "AB", address_postal: "T4A 2J4", address_country: "Canada", address_lat: 51.2917, address_lng: -114.0144, notes: "", tags: [] },
        { name: "Scott Lang", phone: "(403) 555-1022", email: "scott.lang@email.com", address_street: "88 Milligan Dr", address_city: "Okotoks", address_region: "AB", address_postal: "T1S 1V4", address_country: "Canada", address_lat: 50.7264, address_lng: -113.9756, notes: "Long driveway.", tags: [] },
        { name: "Hope Pym", phone: "(403) 555-1023", email: "hope.pym@email.com", address_street: "200 Chestermere Blvd", address_city: "Chestermere", address_region: "AB", address_postal: "T1X 1L5", address_country: "Canada", address_lat: 51.035, address_lng: -113.823, notes: "Lakeside property.", tags: ["VIP", "Recurring"] },
      ];

      const { data: insertedCustomers, error: custErr } = await supabase.from("customers").insert(customerRows).select("id, name");
      if (custErr) { console.error("Seed customers error:", custErr); return; }

      // Seed SPs
      const spRows = [
        { name: "Mike Thompson", email: "mike@example.com", phone: "(403) 555-0101", status: "Active", base_address_street: "50 Kensington Rd NW", base_address_city: "Calgary", base_address_region: "AB", base_address_postal: "T2N 3C8", base_address_country: "Canada", base_lat: 51.055, base_lng: -114.09, service_radius_km: 30, max_jobs_per_day: 5, categories: ["Window Cleaning", "Gutter Cleaning"], notes: "Prefers morning shifts.", compliance_status: "Valid", insurance_expiry: "2026-08-15", certifications: ["Licensed Technician", "Safety Certified"], rating: 4.8, reliability_score: 92, completion_rate: 96, on_time_rate: 94, cancellation_rate: 2, acceptance_rate: 88, avg_response_time: "4 min", fairness_share: 12, fairness_status: "Within Target", auto_accept: true, joined_date: "2023-03-15", total_jobs_completed: 342 },
        { name: "Sarah Chen", email: "sarah@example.com", phone: "(403) 555-0102", status: "Active", base_address_street: "215 12th Ave SW", base_address_city: "Calgary", base_address_region: "AB", base_address_postal: "T2R 0G8", base_address_country: "Canada", base_lat: 51.041, base_lng: -114.078, service_radius_km: 40, max_jobs_per_day: 6, categories: ["Window Cleaning", "Pressure Washing", "Gutter Cleaning"], notes: "", compliance_status: "Valid", insurance_expiry: "2026-11-20", certifications: ["Licensed Technician", "Safety Certified", "Master Cleaner"], rating: 4.9, reliability_score: 97, completion_rate: 99, on_time_rate: 97, cancellation_rate: 1, acceptance_rate: 95, avg_response_time: "2 min", fairness_share: 15, fairness_status: "Above Target Share", auto_accept: true, joined_date: "2022-09-01", total_jobs_completed: 512 },
        { name: "James Wilson", email: "james@example.com", phone: "(403) 555-0103", status: "Active", base_address_street: "80 Main St", base_address_city: "Airdrie", base_address_region: "AB", base_address_postal: "T4B 2E3", base_address_country: "Canada", base_lat: 51.29, base_lng: -114.02, service_radius_km: 20, max_jobs_per_day: 4, categories: ["Window Cleaning"], notes: "Based in Airdrie, prefers north Calgary jobs.", compliance_status: "Expiring", insurance_expiry: "2026-03-10", certifications: ["Licensed Technician"], rating: 4.5, reliability_score: 85, completion_rate: 90, on_time_rate: 88, cancellation_rate: 5, acceptance_rate: 72, avg_response_time: "8 min", fairness_share: 8, fairness_status: "Below Target Share", auto_accept: false, joined_date: "2024-01-20", total_jobs_completed: 89 },
        { name: "Emily Rodriguez", email: "emily@example.com", phone: "(403) 555-0104", status: "Active", base_address_street: "340 Centre Ave", base_address_city: "Cochrane", base_address_region: "AB", base_address_postal: "T4C 1K3", base_address_country: "Canada", base_lat: 51.187, base_lng: -114.47, service_radius_km: 35, max_jobs_per_day: 5, categories: ["Pressure Washing", "Gutter Cleaning"], notes: "Based in Cochrane.", compliance_status: "Valid", insurance_expiry: "2026-06-30", certifications: ["Licensed Technician", "Safety Certified"], rating: 4.7, reliability_score: 90, completion_rate: 94, on_time_rate: 92, cancellation_rate: 3, acceptance_rate: 85, avg_response_time: "5 min", fairness_share: 11, fairness_status: "Within Target", auto_accept: true, joined_date: "2023-07-10", total_jobs_completed: 267 },
        { name: "David Park", email: "david@example.com", phone: "(403) 555-0105", status: "Active", base_address_street: "55 2nd St W", base_address_city: "Okotoks", base_address_region: "AB", base_address_postal: "T1S 1A4", base_address_country: "Canada", base_lat: 50.725, base_lng: -113.98, service_radius_km: 25, max_jobs_per_day: 4, categories: ["Window Cleaning", "Pressure Washing"], notes: "Based in Okotoks — far from north Calgary.", compliance_status: "Valid", insurance_expiry: "2027-01-15", certifications: ["Licensed Technician"], rating: 4.6, reliability_score: 88, completion_rate: 92, on_time_rate: 90, cancellation_rate: 4, acceptance_rate: 80, avg_response_time: "6 min", fairness_share: 10, fairness_status: "Within Target", auto_accept: false, joined_date: "2023-11-05", total_jobs_completed: 178 },
        { name: "Lisa Martinez", email: "lisa@example.com", phone: "(403) 555-0106", status: "Suspended", base_address_street: "18 Elgin Meadows Way SE", base_address_city: "Calgary", base_address_region: "AB", base_address_postal: "T2Z 4E3", base_address_country: "Canada", base_lat: 50.935, base_lng: -114.05, service_radius_km: 15, max_jobs_per_day: 3, categories: ["Window Cleaning"], notes: "Insurance expired — suspended pending renewal.", compliance_status: "Suspended", insurance_expiry: "2025-12-01", certifications: ["Licensed Technician"], rating: 4.4, reliability_score: 82, completion_rate: 88, on_time_rate: 85, cancellation_rate: 6, acceptance_rate: 70, avg_response_time: "10 min", fairness_share: 7, fairness_status: "Below Target Share", auto_accept: false, joined_date: "2024-05-12", total_jobs_completed: 45 },
        { name: "Robert Kim", email: "robert@example.com", phone: "(403) 555-0107", status: "Active", base_address_street: "410 Country Hills Blvd NE", base_address_city: "Calgary", base_address_region: "AB", base_address_postal: "T3K 4Y7", base_address_country: "Canada", base_lat: 51.152, base_lng: -114.06, service_radius_km: 45, max_jobs_per_day: 6, categories: ["Window Cleaning", "Gutter Cleaning", "Pressure Washing"], notes: "", compliance_status: "Valid", insurance_expiry: "2026-09-20", certifications: ["Licensed Technician", "Safety Certified", "Master Cleaner"], rating: 4.8, reliability_score: 94, completion_rate: 97, on_time_rate: 95, cancellation_rate: 1, acceptance_rate: 92, avg_response_time: "3 min", fairness_share: 13, fairness_status: "Within Target", auto_accept: true, joined_date: "2022-06-18", total_jobs_completed: 623 },
        { name: "Anna Schmidt", email: "anna@example.com", phone: "(403) 555-0108", status: "Active", base_address_street: "92 Rainbow Falls Way", base_address_city: "Chestermere", base_address_region: "AB", base_address_postal: "T1X 0H3", base_address_country: "Canada", base_lat: 51.038, base_lng: -113.82, service_radius_km: 20, max_jobs_per_day: 3, categories: ["Pressure Washing"], notes: "Based in Chestermere.", compliance_status: "Expiring", insurance_expiry: "2026-03-25", certifications: ["Licensed Technician"], rating: 4.3, reliability_score: 80, completion_rate: 86, on_time_rate: 83, cancellation_rate: 7, acceptance_rate: 68, avg_response_time: "12 min", fairness_share: 6, fairness_status: "Below Target Share", auto_accept: false, joined_date: "2024-08-01", total_jobs_completed: 32 },
        { name: "Carlos Ruiz", email: "carlos@example.com", phone: "(403) 555-0109", status: "Active", base_address_street: "720 14th St NW", base_address_city: "Calgary", base_address_region: "AB", base_address_postal: "T2N 2A4", base_address_country: "Canada", base_lat: 51.061, base_lng: -114.095, service_radius_km: 30, max_jobs_per_day: 5, categories: ["Window Cleaning", "Gutter Cleaning"], notes: "", compliance_status: "Valid", insurance_expiry: "2026-10-05", certifications: ["Licensed Technician", "Safety Certified"], rating: 4.7, reliability_score: 91, completion_rate: 95, on_time_rate: 93, cancellation_rate: 2, acceptance_rate: 87, avg_response_time: "4 min", fairness_share: 11, fairness_status: "Within Target", auto_accept: true, joined_date: "2023-04-22", total_jobs_completed: 298 },
        { name: "Nina Patel", email: "nina@example.com", phone: "(403) 555-0110", status: "Active", base_address_street: "505 Canyon Meadows Dr SE", base_address_city: "Calgary", base_address_region: "AB", base_address_postal: "T2J 6G2", base_address_country: "Canada", base_lat: 50.962, base_lng: -114.065, service_radius_km: 35, max_jobs_per_day: 5, categories: ["Window Cleaning", "Pressure Washing", "Gutter Cleaning"], notes: "", compliance_status: "Valid", insurance_expiry: "2026-07-18", certifications: ["Licensed Technician", "Safety Certified"], rating: 4.6, reliability_score: 89, completion_rate: 93, on_time_rate: 91, cancellation_rate: 3, acceptance_rate: 83, avg_response_time: "5 min", fairness_share: 9, fairness_status: "Within Target", auto_accept: false, joined_date: "2023-09-14", total_jobs_completed: 215 },
      ];

      const { data: insertedSPs, error: spErr } = await supabase.from("service_providers").insert(spRows).select("id, name");
      if (spErr) { console.error("Seed SPs error:", spErr); return; }

      // Build lookup maps for job seeding
      const custMap = new Map((insertedCustomers ?? []).map((c: any) => [c.name, c.id]));
      const spMap = new Map((insertedSPs ?? []).map((s: any) => [s.name, s.id]));

      const jobSeedData = [
        { job_number: "JOB-1001", custName: "John Baker", spName: "Mike Thompson", service_category: "Window Cleaning", estimated_duration: "2 hours", scheduled_date: "2026-02-23", scheduled_time: "09:00 AM", payout: 180, status: "Assigned", job_address_street: "123 Main St NW", job_address_city: "Calgary", job_address_region: "AB", job_address_postal: "T2M 1N5", job_address_country: "Canada", job_lat: 51.0677, job_lng: -114.084, scores: { availabilityFit: 92, proximity: 88, competency: 85, reliability: 92, rating: 96, fairnessAdjustment: 5, finalScore: 91 } },
        { job_number: "JOB-1002", custName: "Maria Santos", spName: null, service_category: "Gutter Cleaning", estimated_duration: "3 hours", scheduled_date: "2026-02-23", scheduled_time: "01:00 PM", payout: 260, status: "Created", job_address_street: "456 Bow Trail SW", job_address_city: "Calgary", job_address_region: "AB", job_address_postal: "T3C 2G3", job_address_country: "Canada", job_lat: 51.043, job_lng: -114.11, scores: { availabilityFit: 78, proximity: 72, competency: 90, reliability: 88, rating: 94, fairnessAdjustment: 8, finalScore: 85 } },
        { job_number: "JOB-1003", custName: "Tom Henderson", spName: null, service_category: "Pressure Washing", estimated_duration: "4 hours", scheduled_date: "2026-02-24", scheduled_time: "10:00 AM", payout: 340, status: "Created", job_address_street: "789 Centre St N", job_address_city: "Calgary", job_address_region: "AB", job_address_postal: "T2E 2P9", job_address_country: "Canada", job_lat: 51.06, job_lng: -114.06, scores: { availabilityFit: 95, proximity: 95, competency: 80, reliability: 90, rating: 92, fairnessAdjustment: 3, finalScore: 92 } },
        { job_number: "JOB-1004", custName: "Rachel Green", spName: "Sarah Chen", service_category: "Window Cleaning", estimated_duration: "1.5 hours", scheduled_date: "2026-02-24", scheduled_time: "02:00 PM", payout: 140, status: "Assigned", job_address_street: "321 17th Ave SW", job_address_city: "Calgary", job_address_region: "AB", job_address_postal: "T2S 0A5", job_address_country: "Canada", job_lat: 51.038, job_lng: -114.075, scores: { availabilityFit: 85, proximity: 65, competency: 95, reliability: 97, rating: 98, fairnessAdjustment: -5, finalScore: 89 } },
        { job_number: "JOB-1005", custName: "Alex Turner", spName: null, service_category: "Gutter Cleaning", estimated_duration: "2.5 hours", scheduled_date: "2026-02-25", scheduled_time: "09:30 AM", payout: 220, status: "Created", job_address_street: "555 Macleod Trail SE", job_address_city: "Calgary", job_address_region: "AB", job_address_postal: "T2G 0A2", job_address_country: "Canada", job_lat: 51.04, job_lng: -114.062, scores: { availabilityFit: 88, proximity: 80, competency: 88, reliability: 85, rating: 90, fairnessAdjustment: 10, finalScore: 88 } },
        { job_number: "JOB-1006", custName: "Diana Prince", spName: "Mike Thompson", service_category: "Window Cleaning", estimated_duration: "2 hours", scheduled_date: "2026-02-25", scheduled_time: "11:00 AM", payout: 175, status: "Assigned", job_address_street: "100 Crowfoot Way NW", job_address_city: "Calgary", job_address_region: "AB", job_address_postal: "T3G 4J2", job_address_country: "Canada", job_lat: 51.123, job_lng: -114.206, scores: { availabilityFit: 90, proximity: 90, competency: 85, reliability: 92, rating: 96, fairnessAdjustment: 4, finalScore: 90 } },
        { job_number: "JOB-1007", custName: "Bruce Wayne", spName: null, service_category: "Pressure Washing", estimated_duration: "5 hours", scheduled_date: "2026-02-26", scheduled_time: "08:00 AM", payout: 420, status: "Created", job_address_street: "900 Deerfoot Trail NE", job_address_city: "Calgary", job_address_region: "AB", job_address_postal: "T2A 5G6", job_address_country: "Canada", job_lat: 51.048, job_lng: -113.985, scores: { availabilityFit: 70, proximity: 55, competency: 92, reliability: 94, rating: 96, fairnessAdjustment: 6, finalScore: 82 } },
        { job_number: "JOB-1008", custName: "Clark Kent", spName: "Emily Rodriguez", service_category: "Window Cleaning", estimated_duration: "1 hour", scheduled_date: "2026-02-26", scheduled_time: "03:00 PM", payout: 95, status: "Completed", job_address_street: "200 University Dr NW", job_address_city: "Calgary", job_address_region: "AB", job_address_postal: "T2N 1N4", job_address_country: "Canada", job_lat: 51.078, job_lng: -114.13, scores: { availabilityFit: 96, proximity: 96, competency: 82, reliability: 90, rating: 94, fairnessAdjustment: 2, finalScore: 93 } },
        { job_number: "JOB-1009", custName: "Peter Parker", spName: null, service_category: "Gutter Cleaning", estimated_duration: "2 hours", scheduled_date: "2026-02-27", scheduled_time: "10:00 AM", payout: 190, status: "Created", job_address_street: "750 9th Ave SE", job_address_city: "Calgary", job_address_region: "AB", job_address_postal: "T2G 0S3", job_address_country: "Canada", job_lat: 51.045, job_lng: -114.053, scores: { availabilityFit: 60, proximity: 75, competency: 85, reliability: 80, rating: 88, fairnessAdjustment: 12, finalScore: 78 } },
        { job_number: "JOB-1010", custName: "Tony Stark", spName: null, service_category: "Pressure Washing", estimated_duration: "3 hours", scheduled_date: "2026-02-27", scheduled_time: "01:00 PM", payout: 290, status: "Created", job_address_street: "500 4th St SW", job_address_city: "Calgary", job_address_region: "AB", job_address_postal: "T2P 2V6", job_address_country: "Canada", job_lat: 51.049, job_lng: -114.072, scores: { availabilityFit: 82, proximity: 85, competency: 78, reliability: 88, rating: 92, fairnessAdjustment: 7, finalScore: 86 } },
      ];

      const jobRows = jobSeedData.map((j) => ({
        job_number: j.job_number,
        customer_id: custMap.get(j.custName) ?? null,
        assigned_sp_id: j.spName ? spMap.get(j.spName) ?? null : null,
        service_category: j.service_category,
        estimated_duration: j.estimated_duration,
        scheduled_date: j.scheduled_date,
        scheduled_time: j.scheduled_time,
        payout: j.payout,
        status: j.status,
        job_address_street: j.job_address_street,
        job_address_city: j.job_address_city,
        job_address_region: j.job_address_region,
        job_address_postal: j.job_address_postal,
        job_address_country: j.job_address_country,
        job_lat: j.job_lat,
        job_lng: j.job_lng,
        scores: j.scores ?? null,
      }));

      const { error: jobErr } = await supabase.from("jobs").insert(jobRows);
      if (jobErr) console.error("Seed jobs error:", jobErr);

      // Trigger seed-users edge function
      try {
        await supabase.functions.invoke("seed-users");
      } catch (e) {
        console.warn("seed-users function call failed (may already be seeded):", e);
      }

      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["service_providers"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    })();
  }, [qc]);
}

// ===== Customer Activity Log =====

export interface CustomerActivityLogEntry {
  id: string;
  customer_id: string;
  job_id: string | null;
  event_type: string;
  summary: string;
  details: any;
  actor_user_id: string | null;
  actor_email: string;
  actor_role: string;
  created_at: string;
}

export function useCustomerActivityLog(customerId: string | undefined) {
  return useQuery({
    queryKey: ["customer-activity", customerId],
    enabled: !!customerId,
    queryFn: async (): Promise<CustomerActivityLogEntry[]> => {
      const { data, error } = await (supabase as any)
        .from("customer_activity_log")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CustomerActivityLogEntry[];
    },
  });
}

export function useGlobalActivityLog(limit = 200) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = (supabase as any)
      .channel("global-activity-log")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "customer_activity_log" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["global-activity"] });
        },
      )
      .subscribe();
    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["global-activity", limit],
    queryFn: async (): Promise<CustomerActivityLogEntry[]> => {
      const { data, error } = await (supabase as any)
        .from("customer_activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as CustomerActivityLogEntry[];
    },
  });
}
