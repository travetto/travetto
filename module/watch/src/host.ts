import * as ts from 'typescript';

export const WatchHost = {
  watchFile: ts.sys.watchFile,
  watchDirectory: ts.sys.watchDirectory,
  CreatedEvent: ts.FileWatcherEventKind.Created,
  ChangedEvent: ts.FileWatcherEventKind.Changed,
  DeletedEvent: ts.FileWatcherEventKind.Deleted
};
