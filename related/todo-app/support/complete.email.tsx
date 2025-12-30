/** @jsxImportSource @travetto/email-inky/support */

import { Container, InkyTemplate, Summary, Title, Value } from '@travetto/email-inky';

export default <InkyTemplate>
  <Title>Todo Complete</Title>
  <Summary>Todo Complete</Summary>
  <Container>
    <h1 className="text-center">Hello World</h1>
    <p className="text-center">
      <Value attr='name' />, your todo is successfully completed
    </p>
  </Container>
</InkyTemplate>;