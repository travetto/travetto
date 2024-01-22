/** @jsxImportSource @travetto/email-inky */

import { Container, InkyTemplate, Summary, Title, Value } from '@travetto/email-inky';

export default <InkyTemplate>
  <Title>Todo Completed</Title>
  <Summary>Todo Complete</Summary>
  <Container>
    <p>
      <Value attr='name' />, your todo is successfully completed
    </p>
  </Container>
</InkyTemplate>;