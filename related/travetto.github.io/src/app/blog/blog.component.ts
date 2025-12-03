import { Component, resource } from '@angular/core';
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
  @for (post of posts.value(); track $index) {
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
  styleUrls: ['./blog.component.css']
})
export class BlogComponent {

  posts = resource({
    params: () => ({
      key: 'AIzaSyBfg2W_JaAJU4qQWSKs-Vx_zVbFh4joYos',
      blogId: '8362979454426216505'
    }),
    loader: ({ params }) =>
      fetch(`https://www.googleapis.com/blogger/v3/blogs/${params.blogId}/posts/?key=${params.key}`)
        .then(response => response.json())
        .then<Post[]>(data => data.items.slice(0, 3))

  }).asReadonly();
}

