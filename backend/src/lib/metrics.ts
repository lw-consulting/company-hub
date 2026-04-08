import { performance } from 'node:perf_hooks';

interface LoggerLike {
  info: (obj: Record<string, unknown>, msg?: string) => void;
  warn: (obj: Record<string, unknown>, msg?: string) => void;
}

interface MetricOptions {
  metric: string;
  logger: LoggerLike;
  slowMs?: number;
  context?: Record<string, unknown>;
}

export async function measureAsync<T>(
  options: MetricOptions,
  fn: () => Promise<T>
): Promise<T> {
  const startedAt = performance.now();

  try {
    const result = await fn();
    const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
    const payload = {
      metric: options.metric,
      durationMs,
      ...(options.context ?? {}),
    };

    if (durationMs >= (options.slowMs ?? 500)) {
      options.logger.warn(payload, 'Slow metric');
    } else {
      options.logger.info(payload, 'Metric');
    }

    return result;
  } catch (error) {
    const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
    options.logger.warn(
      {
        metric: options.metric,
        durationMs,
        failed: true,
        ...(options.context ?? {}),
      },
      'Metric failed'
    );
    throw error;
  }
}
