/** @jsxImportSource @travetto/email-inky */

import { Title, Container, Summary, Row, Column, If, inkyTpl, Button } from '@travetto/email-inky';

export default inkyTpl(<>
  <Title>Test Email</Title>
  <Summary>Email Summary</Summary>
  <Container>
    <If value='person'>
      <Row>
        <Column small={5}>
          <Button href='https://google.com'>Hello World</Button>
        </Column>
      </Row>
    </If>
  </Container>
</>);