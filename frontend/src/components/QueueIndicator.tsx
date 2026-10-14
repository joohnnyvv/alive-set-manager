import type { Component } from 'solid-js';

interface QueueIndicatorProps {
  queuedName: string;
  onCancel: () => void;
  onJumpNow: () => void;
}

const QueueIndicator: Component<QueueIndicatorProps> = (props) => {
  return (
    <div class="queue-banner">
      <div class="queue-banner-info">
        <span class="queue-spinner-dot"></span>
        {' Jumping to: '}
        <strong>{props.queuedName}</strong>
      </div>
      <div class="queue-banner-actions">
        <button class="btn-queue-cancel" onClick={props.onCancel}>Cancel</button>
        <button class="btn-queue-now" onClick={props.onJumpNow}>Jump Now</button>
      </div>
    </div>
  );
};

export default QueueIndicator;
