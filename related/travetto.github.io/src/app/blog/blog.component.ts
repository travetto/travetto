import { Component, OnInit } from '@angular/core';

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
  templateUrl: './blog.component.html',
  styleUrls: ['./blog.component.scss']
})
export class BlogComponent implements OnInit {

  blogId = '8362979454426216505';
  posts: Post[] = [];

  constructor() { }

  ngOnInit() {
    const key = 'AIzaSyBfg2W_JaAJU4qQWSKs-Vx_zVbFh4joYos';

    fetch(
      `https://www.googleapis.com/blogger/v3/blogs/${this.blogId}/posts/?key=${key}`,
    )
      .then(res => res.json())
      .then(data => this.posts = data.items.slice(0, 3));
  }
}
