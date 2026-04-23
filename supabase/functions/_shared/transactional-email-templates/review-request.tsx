import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'WinDucks'

interface ReviewRequestProps {
  customerName?: string
  spName?: string
  jobNumber?: string
  reviewUrl?: string
}

const ReviewRequestEmail = ({
  customerName,
  spName = 'your service provider',
  jobNumber = '',
  reviewUrl = '#',
}: ReviewRequestProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>How did {spName} do? Share a quick rating.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {customerName ? `Hi ${customerName},` : 'Hi there,'}
        </Heading>
        <Text style={text}>
          Thanks for choosing {SITE_NAME}. Your job{jobNumber ? ` ${jobNumber}` : ''} with{' '}
          <strong>{spName}</strong> was just marked complete.
        </Text>
        <Text style={text}>
          Could you take 30 seconds to rate three things — on-time arrival, quality of work,
          and communication? Your feedback keeps our service providers accountable and helps
          other customers.
        </Text>
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={reviewUrl} style={button}>
            Rate your experience
          </Button>
        </Section>
        <Text style={muted}>
          Or paste this link into your browser:<br />
          <span style={{ wordBreak: 'break-all' }}>{reviewUrl}</span>
        </Text>
        <Text style={footer}>— The {SITE_NAME} team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ReviewRequestEmail,
  subject: (data: Record<string, any>) =>
    `How did ${data?.spName ?? 'your provider'} do?${data?.jobNumber ? ` — ${data.jobNumber}` : ''}`,
  displayName: 'Customer review request',
  previewData: {
    customerName: 'Jane',
    spName: 'Alex Smith',
    jobNumber: 'JOB-0001',
    reviewUrl: 'https://winducksapp.lovable.app/review/sample-token',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const muted = { fontSize: '12px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 16px' }
const footer = { fontSize: '13px', color: '#6b7280', margin: '32px 0 0' }
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
