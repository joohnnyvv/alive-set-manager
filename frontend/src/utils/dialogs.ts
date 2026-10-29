export function manageDialogs() {
  let current: HTMLElement | null = null;
  let previous: HTMLElement | null = null;
  const observer = new MutationObserver(() => {
    const modal = document.querySelector<HTMLElement>('.modal-content');
    if (modal === current) return;
    if (modal) {
      previous = document.activeElement as HTMLElement; current = modal;
      modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true');
      const heading = modal.querySelector('h3'); if (heading) { heading.id='active-dialog-heading'; modal.setAttribute('aria-labelledby',heading.id); }
      (modal.querySelector<HTMLElement>('input,select,textarea') || modal.querySelector<HTMLElement>('button'))?.focus();
    } else { current = null; previous?.focus(); }
  });
  observer.observe(document.body,{childList:true,subtree:true});
  const key = (e: KeyboardEvent) => {
    if (!current) return;
    if (e.key === 'Escape') { e.preventDefault(); current.querySelector<HTMLButtonElement>('.modal-close')?.click(); }
    if (e.key !== 'Tab') return;
    const elements = [...current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')];
    const first=elements[0], last=elements.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
    if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  };
  document.addEventListener('keydown',key);
  return () => { observer.disconnect(); document.removeEventListener('keydown',key); };
}
