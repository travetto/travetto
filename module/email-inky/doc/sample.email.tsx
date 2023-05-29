/** @jsxImportSource @travetto/email-inky */

import { Title, Container, Summary, Row, Column, If, inkyTpl, Button } from '@travetto/email-inky';

export default inkyTpl(<>
  <Title>Test Email</Title>
  <Summary>Email Summary</Summary>
  <Container>
    <If value='person'>
      <Row>
        <Column small={5}>
          <Button href='https://google.com/[[person]]'>Hello [[person]]</Button>
        </Column>
      </Row>
    </If>
  </Container>
</>);