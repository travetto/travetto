/** @jsxImportSource @travetto/email-inky/support */

import { Title, Container, Summary, Row, Column, If, Button, Value, InkyTemplate } from '@travetto/email-inky';

export default <InkyTemplate>
  <Title>Test Email</Title>
  <Summary>Email Summary</Summary>
  <Container>
    <If attr='person'>
      <Row>
        <Column small={5}>
          <Button href='https://google.com/{{query}}'>Hello <Value attr='name' /></Button>
        </Column>
      </Row>
    </If>
  </Container>
</InkyTemplate>;