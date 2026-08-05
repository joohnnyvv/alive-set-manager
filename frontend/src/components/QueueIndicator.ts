export function renderQueueIndicator(
  queuedName: string,
  onCancel: () => void,
  onJumpNow: () => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'queue-banner';

  const labelBox = document.createElement('div');
  labelBox.className = 'queue-banner-info';
  labelBox.innerHTML = `<span class="queue-spinner">⏳</span> Jumping to: <strong>${queuedName}</strong>`;

  const btnBox = document.createElement('div');
  btnBox.className = 'queue-banner-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn-queue-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = onCancel;

  const nowBtn = document.createElement('button');
  nowBtn.className = 'btn-queue-now';
  nowBtn.textContent = 'Jump Now';
  nowBtn.onclick = onJumpNow;

  btnBox.appendChild(cancelBtn);
  btnBox.appendChild(nowBtn);

  container.appendChild(labelBox);
  container.appendChild(btnBox);

  return container;
}
