import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';

interface Post {
  author: {
    id: string;
    displayName: string;
  };
  blog: {
    id: string;
  };
  content: string;
  etag: string;
  id: string;
  published: Date;
  title: string;
  updated: Date;
  url: string;
}

@Component({
  selector: 'app-blog',
  imports: [DatePipe],
  template: `
<div class="documentation">
  @for (post of posts; track $index) {
    <article>
      <h2>
        {{post.title}}
      </h2>
      <div class="meta">
        <span class="date">
          {{post.published | date }}
        </span>
        <div class="byline">
          {{post.author.displayName}}
        </div>
      </div>
      <div class="content" [innerHTML]="post.content"></div>
    </article>
  }
</div>
`,
  styleUrls: ['./blog.component.scss']
})
export class BlogComponent implements OnInit {

  blogId = '8362979454426216505';
  posts: Post[] = [];

  ngOnInit(): void {
    const key = 'AIzaSyBfg2W_JaAJU4qQWSKs-Vx_zVbFh4joYos';

    fetch(
      `https://www.googleapis.com/blogger/v3/blogs/${this.blogId}/posts/?key=${key}`,
    )
      .then(res => res.json())
      .then(data => this.posts = data.items.slice(0, 3));
  }
}
