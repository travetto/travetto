import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { OpenapiComponent } from './openapi.component';

describe('OpenapiComponent', () => {
  let component: OpenapiComponent;
  let fixture: ComponentFixture<OpenapiComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ OpenapiComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OpenapiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
