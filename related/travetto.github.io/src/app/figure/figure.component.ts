import { Component, OnInit, ElementRef } from '@angular/core';

@Component({
  selector: 'figure',
  templateUrl: './figure.component.html',
  styleUrls: ['./figure.component.scss']
})
export class FigureComponent implements OnInit {

  constructor(private elementRef: ElementRef) { }

  ngOnInit() {
    const node = this.elementRef.nativeElement as HTMLElement;
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
