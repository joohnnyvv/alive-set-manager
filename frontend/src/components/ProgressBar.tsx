import type { Component } from 'solid-js';
import { formatDuration } from '../utils/formatTime.js';

interface ProgressBarProps {
  progress: number;  // 0 to 1
  elapsedSeconds: number;
  totalSeconds: number;
  label: string;
}

const ProgressBar: Component<ProgressBarProps> = (props) => {
  // Use props directly (they are reactive getters in Solid)
  return (
    <div class="progress-bar-container">
      <div class="progress-meta">
        <span class="progress-label">{props.label}</span>
        <span class="progress-time">{formatDuration(props.elapsedSeconds)} / {formatDuration(props.totalSeconds)}</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style={{ width: `${Math.max(0, Math.min(100, props.progress * 100))}%` }}></div>
      </div>
    </div>
  );
};

export default ProgressBar;
