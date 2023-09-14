/** @jsxImportSource @travetto/email-inky */

import {
  Container,
  InkyTemplate,
  Title,
  Column,
  Row,
  Spacer,
  Value,
} from '@travetto/email-inky';

export default (
  <InkyTemplate>
    <Title>Hello World</Title>
    <Container className='header-container' style={'background-image: url(/images/crab.png);'}>
      <Row className='top-header'>
        <Column className='logo-container' large={8}>
          <img src='/images/crab.png' />
          <Spacer size={32} />
          <p className='bold text-xl'>
            Did you make a purchase at change <Value attr='vendor' />
          </p>
          <p>
            Your alert threshold is set to <Value attr='limit' />
          </p>
        </Column>
        <Column large={4} className='illustration-header'>
          <img src='/images/crab.png' />
        </Column>
      </Row>
      <Row>
        <p className='bold'>
          <Value attr='bank' />
        </p>
      </Row>
    </Container>
  </InkyTemplate>
);