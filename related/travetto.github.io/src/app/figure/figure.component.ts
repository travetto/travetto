import { Component, OnInit, Input, ElementRef, HostBinding } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'figure',
  templateUrl: './figure.component.html',
  styleUrls: ['./figure.component.scss']
})
export class FigureComponent implements OnInit {

  constructor(private elementRef: ElementRef, private snackbar: MatSnackBar) { }

  ngOnInit() {
    const node = this.elementRef.nativeElement as HTMLElement;
    const cls = node.className;
    if (cls === 'code' || cls === 'install' || cls === 'config') {
      const code = node.querySelector('code');
      code.addEventListener('click', () => {
        const text = code.innerText.replace(/^\s*[$]\s*/, '');
        navigator.clipboard.writeText(text);
        this.snackbar.open('Copied to clipboard', 'dismiss', {
          duration: 5000
        });
      });
    }
  }
}
