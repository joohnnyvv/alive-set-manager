import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Timekeeper } from './timekeeper.js';

describe('Timekeeper Engine', () => {

  test('lookahead scheduler executes scheduled callbacks accurately', async () => {
    const tk = new Timekeeper();
    tk.start();
    tk.updateTime(10, 120);

    let executed = false;
    tk.scheduleAt(10.05, () => {
      executed = true;
    });

    // Advance timekeeper time
    tk.updateTime(10.06, 120);

    await new Promise(resolve => setTimeout(resolve, 60));
    tk.stop();
    assert.equal(executed, true, 'Scheduled callback should execute when beat time reaches target');
  });

  test('scheduler handles async callback rejections without crashing', async () => {
    const tk = new Timekeeper();
    tk.start();
    tk.updateTime(10, 120);

    let rejectedHandled = false;
    tk.scheduleAt(10.02, async () => {
      rejectedHandled = true;
      throw new Error('Async rejection inside scheduled event');
    });

    tk.updateTime(10.05, 120);

    await new Promise(resolve => setTimeout(resolve, 80));
    tk.stop();

    assert.equal(rejectedHandled, true, 'Async callback was scheduled and caught safely');
  });

  test('cancels scheduled event when cancelEvent is called', async () => {
    const tk = new Timekeeper();
    tk.start();
    tk.updateTime(0, 120);

    let executed = false;
    const eventId = tk.scheduleAt(5, () => {
      executed = true;
    });

    tk.cancelEvent(eventId);
    tk.updateTime(6, 120);

    await new Promise(resolve => setTimeout(resolve, 50));
    tk.stop();

    assert.equal(executed, false, 'Cancelled scheduled event must not execute');
  });

});
