/** @jsxImportSource @travetto/email-inky */

import { Title, Container, Summary, Row, Column, If, inkyTpl, Button, Value } from '@travetto/email-inky';

export default inkyTpl(<>
  <Title>Test Email</Title>
  <Summary>Email Summary</Summary>
  <Container>
    <If key='person'>
      <Row>
        <Column small={5}>
          <Button href='https://google.com/[[query]]'>Hello <Value key='name' /></Button>
        </Column>
      </Row>
    </If>
  </Container>
</>);