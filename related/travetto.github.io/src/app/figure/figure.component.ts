import { Component, OnInit, ElementRef } from '@angular/core';

@Component({
  selector: 'figure',
  template: '<ng-content></ng-content>',
  styles: [`
  :host ::ng-deep * {
  user-select: none;
}

:host ::ng-deep code {
  cursor: pointer;
}
`],
  standalone: true
})
export class FigureComponent implements OnInit {

  elementRef: ElementRef<HTMLElement>;

  constructor(elementRef: ElementRef<HTMLElement>) {
    this.elementRef = elementRef;
  }

  ngOnInit(): void {
    const node = this.elementRef.nativeElement;
    const cls = node.className;
    if (cls === 'code' || cls === 'install' || cls === 'config') {
      const code = node.querySelector('code');
      code.addEventListener('click', () => {
        const text = code.innerText.replace(/^\s*[$]\s*/, '');
        navigator.clipboard.writeText(text);
      });
    }
  }
}
