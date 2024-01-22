/** @jsxImportSource @travetto/email-inky */

import { Container, InkyTemplate, Summary, Title, Value } from '@travetto/email-inky';

export default <InkyTemplate>
  <Title>Todo Completed</Title>
  <Summary>Todo Complete</Summary>
  <Container>
    <h1 className="text-center">Hello World</h1>
    <p className="text-center">
      <Value attr='name' />, your todos is successfully completed
    </p>
  </Container>
</InkyTemplate>;