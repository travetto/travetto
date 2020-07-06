import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

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

  constructor(private client: HttpClient) { }

  ngOnInit() {
    const key = 'AIzaSyBfg2W_JaAJU4qQWSKs-Vx_zVbFh4joYos';
    this.client.get<{ items: Post[] }>(
      `https://www.googleapis.com/blogger/v3/blogs/${this.blogId}/posts/?key=${key}`,
    ).subscribe(data => {
      this.posts = data.items;
    });
  }
}
