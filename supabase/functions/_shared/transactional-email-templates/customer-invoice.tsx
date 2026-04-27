import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'WinDucks'

interface CustomerInvoiceProps {
  customerName?: string
  invoiceNumber?: string
  total?: string
  invoiceUrl?: string
  companyName?: string
  paymentTerms?: string
}

const CustomerInvoiceEmail = ({
  customerName,
  invoiceNumber = '',
  total = '',
  invoiceUrl = '#',
  companyName = SITE_NAME,
  paymentTerms = '',
}: CustomerInvoiceProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Invoice {invoiceNumber} from {companyName} — {total}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {customerName ? `Hi ${customerName},` : 'Hi there,'}
        </Heading>
        <Text style={text}>
          Thanks for choosing {companyName}. Your invoice <strong>{invoiceNumber}</strong> for{' '}
          <strong>{total}</strong> is ready to view online.
        </Text>
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={invoiceUrl} style={button}>
            View invoice
          </Button>
        </Section>
        {paymentTerms && (
          <>
            <Hr style={hr} />
            <Text style={muted}>
              <strong>Payment terms:</strong> {paymentTerms}
            </Text>
          </>
        )}
        <Text style={muted}>
          Or paste this link into your browser:<br />
          <span style={{ wordBreak: 'break-all' }}>{invoiceUrl}</span>
        </Text>
        <Text style={footer}>— The {companyName} team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CustomerInvoiceEmail,
  subject: (data: Record<string, any>) =>
    `Invoice ${data?.invoiceNumber ?? ''} from ${data?.companyName ?? SITE_NAME}`.trim(),
  displayName: 'Customer invoice',
  previewData: {
    customerName: 'Jane',
    invoiceNumber: 'INV-1001',
    total: '$420.00',
    companyName: 'WinDucks',
    paymentTerms: 'Payment due within 15 days.',
    invoiceUrl: 'https://winducksapp.lovable.app/invoice/sample-token',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const muted = { fontSize: '12px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 16px' }
const footer = { fontSize: '13px', color: '#6b7280', margin: '32px 0 0' }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const button = {
  backgroundColor: '#2563eb',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  textDecoration: 'none',
  display: 'inline-block',
}
