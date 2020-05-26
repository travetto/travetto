<div class="modules">
  <div [class]="page.path" *ngFor="let page of pages">
    <a [routerLink]="'/docs/' + page.path" [innerHtml]="page.title"></a>
    <ul *ngIf="page.subs && page.subs.length">
      <li class="sub" *ngFor="let sub of page.subs">
        <a [routerLink]="'/docs/' + page.path" [fragment]="sub.path" [innerHtml]="sub.title"></a>
      </li>
    </ul>
  </div>
</div>