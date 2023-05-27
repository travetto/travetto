import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RestClientComponent } from './rest-client.component';

describe('RestClientComponent', () => {
  let component: RestClientComponent;
  let fixture: ComponentFixture<RestClientComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RestClientComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RestClientComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
