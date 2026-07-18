/** @jsxImportSource @travetto/email-inky/support */

import { Button, Column, Container, If, InkyTemplate, Row, Summary, Title } from '@travetto/email-inky';

export default (
  <InkyTemplate>
    <Title>Test Email</Title>
    <Summary>Email Summary</Summary>
    <Container style={'background-image: url(/images/crab.png);'}>
      <If attr="person">
        <Row>
          <Column small={5}>
            <Button href="https://google.com/?{{search}}">Hello World</Button>
          </Column>
        </Row>
      </If>
    </Container>
  </InkyTemplate>
);
