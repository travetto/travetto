import { Injectable } from '@travetto/di';
import { WorkPool } from '@travetto/worker';

export interface ImageProcessingTask {
  imageId: string;
  sourceUrl: string;
  targetFormat: 'png' | 'webp' | 'jpeg';
}

export interface ImageProcessingResult {
  imageId: string;
  bytesProcessed: number;
  outputUrl: string;
}

@Injectable()
export class ImageBatchProcessor {
  /**
   * Process a list of image transformation tasks in parallel using WorkPool.run
   */
  async processBatch(tasks: ImageProcessingTask[]): Promise<void> {
    // Execute tasks in parallel across the worker pool
    await WorkPool.run(
      async (task: ImageProcessingTask): Promise<ImageProcessingResult> => {
        return {
          imageId: task.imageId,
          bytesProcessed: 1024 * 50,
          outputUrl: `https://cdn.example.com/processed/${task.imageId}.${task.targetFormat}`
        };
      },
      tasks,
      {
        max: 4,
        total: tasks.length,
        onComplete({ input, output, progress }) {
          console.log(`Processed image ${input.imageId}: ${output.outputUrl} (${progress.completed}/${progress.total})`);
        }
      }
    );
  }

  /**
   * Stream results as they complete using WorkPool.runStream
   */
  async *streamBatchProcessing(tasks: ImageProcessingTask[]) {
    const events = WorkPool.runStream(
      async (task: ImageProcessingTask): Promise<ImageProcessingResult> => {
        return {
          imageId: task.imageId,
          bytesProcessed: 1024 * 50,
          outputUrl: `https://cdn.example.com/processed/${task.imageId}.${task.targetFormat}`
        };
      },
      tasks,
      { max: 2 }
    );

    for await (const event of events) {
      if (event.output) {
        yield event.output;
      }
    }
  }
}
