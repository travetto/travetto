/** @jsxImportSource @travetto/email-inky/support */
import { Button, Column, Container, InkyTemplate, Row, Summary, Title, Value } from '@travetto/email-inky';

/**
 * Sample Inky JSX template compiled by @travetto/email-compiler
 */
export const OrderConfirmationInkyTemplate = (
  <InkyTemplate>
    <Title>
      Order Confirmation #<Value attr="orderNumber" />
    </Title>
    <Summary>Thank you for your purchase</Summary>
    <Container>
      <Row>
        <Column small={12}>
          <h2>
            Thank you for your order, <Value attr="customerName" />!
          </h2>
          <Button href="https://example.com/orders/{{orderNumber}}">View Order Status</Button>
        </Column>
      </Row>
    </Container>
  </InkyTemplate>
);
