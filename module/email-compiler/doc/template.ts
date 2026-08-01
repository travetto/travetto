import type { EmailCompiled } from '@travetto/email';

/**
 * An EmailCompiled object representing the compiled output of an email template
 * containing HTML, plain text, and subject line templates.
 */
export const OrderConfirmationCompiled: EmailCompiled = {
  subject: 'Order Confirmation #{{orderNumber}}',
  text: 'Hello {{customerName}}, thank you for your order #{{orderNumber}} for {{orderTotal}}.',
  html: '<h2>Thank you for your order, {{customerName}}!</h2><p>Order <strong>#{{orderNumber}}</strong> total: <strong>{{orderTotal}}</strong>.</p>'
};
