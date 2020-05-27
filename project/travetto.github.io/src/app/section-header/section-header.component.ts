import { Component, OnInit, Input, ElementRef, HostBinding } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-section-header',
  templateUrl: './section-header.component.html',
  styleUrls: ['./section-header.component.scss']
})
export class SectionHeaderComponent implements OnInit {

  @HostBinding('class')
  @Input()
  headerType: string;

  constructor(private elementRef: ElementRef, private snackbar: MatSnackBar) { }

  ngOnInit() {
  }

  canCopy() {
    return this.headerType === 'code' || this.headerType === 'install' || this.headerType === 'config';
  }

  copyToClipboard() {
    let text = (this.elementRef.nativeElement as HTMLElement).nextSibling.textContent;
    const el = document.createElement('textarea');
    if (this.headerType === 'install') {
      text = text.replace(/^\s*[$]\s*/, '');
    }
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    this.snackbar.open('Successfully copied to clipboard', 'dismiss', {
      duration: 5000
    });
  }
}
