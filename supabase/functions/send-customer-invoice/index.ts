// Sends a customer invoice email and marks the invoice as Sent.
// Strategy:
// 1. Validate caller (admin/owner via JWT).
// 2. Load invoice + customer + company settings from DB (service role).
// 3. Build the public invoice URL using SITE_URL.
// 4. Invoke `send-transactional-email` with the `customer-invoice` template.
// 5. Call `mark_customer_invoice_sent` RPC to flip status to Sent + job to InvoiceSent.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_URL = 'https://winducksapp.lovable.app'

function fmtCAD(n: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(n) || 0)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  // Caller auth — must be a logged-in admin/owner.
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData } = await userClient.auth.getUser()
  if (!userData?.user) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Parse body
  let invoiceId: string
  try {
    const body = await req.json()
    invoiceId = body.invoice_id || body.invoiceId
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!invoiceId) {
    return new Response(JSON.stringify({ error: 'invoice_id is required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Service role for DB reads
  const admin = createClient(supabaseUrl, serviceKey)

  // Verify role
  const { data: roles } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', userData.user.id)
  const isAdmin = (roles ?? []).some((r: any) => r.role === 'admin' || r.role === 'owner')
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'Forbidden — admin only' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Load invoice
  const { data: inv, error: invErr } = await admin
    .from('customer_invoices')
    .select('*')
    .eq('id', invoiceId)
    .maybeSingle()
  if (invErr || !inv) {
    return new Response(JSON.stringify({ error: 'Invoice not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Customer
  let customerEmail = ''
  let customerName = ''
  if (inv.customer_id) {
    const { data: cust } = await admin
      .from('customers')
      .select('name, email')
      .eq('id', inv.customer_id)
      .maybeSingle()
    customerEmail = cust?.email ?? ''
    customerName = cust?.name ?? ''
  }
  if (!customerEmail) {
    return new Response(
      JSON.stringify({ error: 'Customer has no email on file. Use the public link instead.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Company name
  const { data: settings } = await admin
    .from('app_settings')
    .select('company_name')
    .eq('id', 1)
    .maybeSingle()

  const invoiceUrl = `${SITE_URL}/invoice/${inv.share_token}`

  // Invoke the transactional email function (it handles suppression, queueing, retries)
  const sendResp = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      templateName: 'customer-invoice',
      recipientEmail: customerEmail,
      templateData: {
        customerName,
        invoiceNumber: inv.invoice_number,
        total: fmtCAD(inv.total),
        invoiceUrl,
        companyName: settings?.company_name || 'WinDucks',
        paymentTerms: inv.payment_terms || '',
      },
    }),
  })

  const sendJson = await sendResp.json().catch(() => ({}))
  if (!sendResp.ok || sendJson.error) {
    console.error('Failed to enqueue invoice email', sendJson)
    return new Response(
      JSON.stringify({ error: sendJson.error || 'Failed to send email' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Mark invoice as sent (using user JWT so RLS + auth.uid() work for the audit row).
  const { data: markData, error: markErr } = await userClient.rpc('mark_customer_invoice_sent', {
    _invoice_id: invoiceId,
    _pdf_path: '',
  })
  if (markErr) {
    console.error('mark_customer_invoice_sent failed', markErr)
    return new Response(
      JSON.stringify({ error: 'Email queued, but failed to update invoice status' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  return new Response(
    JSON.stringify({ success: true, queued: true, invoice_url: invoiceUrl, mark: markData }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
