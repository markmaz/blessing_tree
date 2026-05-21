import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AutoDismissAlert } from '@/shared/ui/AutoDismissAlert';

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe('AutoDismissAlert', () => {
  it('fades and dismisses itself after the configured duration', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();

    render(
      <AutoDismissAlert
        message="Campaign updated."
        onDismiss={onDismiss}
        durationMs={1200}
        fadeDurationMs={200}
      />
    );

    expect(screen.getByRole('alert')).not.toHaveClass('is-exiting');

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByRole('alert')).toHaveClass('is-exiting');

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('allows manual dismissal before the timer elapses', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();

    render(
      <AutoDismissAlert
        message="Campaign updated."
        onDismiss={onDismiss}
        durationMs={1200}
        fadeDurationMs={200}
      />
    );

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    });
    expect(screen.getByRole('alert')).toHaveClass('is-exiting');

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
