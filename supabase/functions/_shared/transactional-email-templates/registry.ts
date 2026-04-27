/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as reviewRequest } from './review-request.tsx'
import { template as customerInvoice } from './customer-invoice.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'review-request': reviewRequest,
  'customer-invoice': customerInvoice,
}
