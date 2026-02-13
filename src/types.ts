export type ViewState = 'feeds' | 'posts' | 'comments' | 'comment-detail';

export type RedditPost = {
  id: string;
  title: string;
  ups: number;
  permalink: string;
  subreddit: string;
  author: string;
  createdUtcSeconds: number;
  numComments: number;
};

export type RedditComment = {
  body: string;
  author: string;
  createdUtcSeconds: number;
  ups: number;
  depth: number;
};

export type FeedOption = {
  label: string;
  description: string;
  path: string; // '' for /top.json, 'r/sub1+sub2' for multireddit
};
