export interface ScheduledEvent {
  id: string;
  beatTime: number;
  callback: () => void | Promise<void>;
  triggered: boolean;
}

export class Timekeeper {
  private lookaheadMs = 25.0;     // Run tick every 25ms
  private scheduleAheadMs = 100.0; // Look 100ms into future
  private timerID?: NodeJS.Timeout;
  private currentBeatTime = 0;
  private tempo = 120;
  private scheduledEvents: ScheduledEvent[] = [];
  private nextId = 1;

  public start(): void {
    if (!this.timerID) {
      this.timerID = setInterval(() => this.tick(), this.lookaheadMs);
    }
  }

  public stop(): void {
    if (this.timerID) {
      clearInterval(this.timerID);
      this.timerID = undefined;
    }
  }

  public updateTime(beatTime: number, tempo: number): void {
    this.currentBeatTime = beatTime;
    this.tempo = tempo > 0 ? tempo : 120;
  }

  private tick(): void {
    const current = this.currentBeatTime;
    const aheadBeats = (this.scheduleAheadMs / 1000 / 60) * this.tempo;

    for (const event of this.scheduledEvents) {
      if (event.beatTime <= current + aheadBeats && !event.triggered) {
        event.triggered = true;
        try {
          const result = event.callback();
          if (result && typeof (result as any).catch === 'function') {
            (result as Promise<void>).catch((err) => {
              console.error(`[Timekeeper] Async error executing event ${event.id}:`, err);
            });
          }
        } catch (err) {
          console.error(`[Timekeeper] Error executing event ${event.id}:`, err);
        }
      }
    }

    // Filter out triggered events
    this.scheduledEvents = this.scheduledEvents.filter(e => !e.triggered && e.beatTime > current - 4);
  }

  public scheduleAt(beatTime: number, callback: () => void | Promise<void>): string {
    const id = `event-${this.nextId++}`;
    this.scheduledEvents.push({
      id,
      beatTime,
      callback,
      triggered: false,
    });
    return id;
  }

  public cancelEvent(id: string): void {
    this.scheduledEvents = this.scheduledEvents.filter(e => e.id !== id);
  }

  public clearAll(): void {
    this.scheduledEvents = [];
  }
}
