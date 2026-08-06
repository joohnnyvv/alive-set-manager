import easymidi from 'easymidi';
import fs from 'fs/promises';
import path from 'path';
import { MidiMapping, MidiAction, MidiMessageType } from '../types/index.js';

const MIDI_FILE = path.join(process.cwd(), 'midi-mappings.json');

export class MidiEngine {
  private inputs: Map<string, easymidi.Input> = new Map();
  private mappings: MidiMapping[] = [];
  private isLearning = false;
  private learningMappingId?: string;

  constructor(
    private onActionTriggered: (action: MidiAction) => void,
    private onMidiLearned?: (mappingId: string, mapping: MidiMapping) => void
  ) {}

  public async init(): Promise<void> {
    await this.loadMappings();
    this.refreshDevices();
  }

  public getDevices(): { inputs: string[]; outputs: string[] } {
    try {
      return {
        inputs: easymidi.getInputs(),
        outputs: easymidi.getOutputs(),
      };
    } catch (err) {
      console.warn('[MidiEngine] Could not fetch MIDI devices:', err);
      return { inputs: [], outputs: [] };
    }
  }

  public refreshDevices(): void {
    try {
      const availableInputs = easymidi.getInputs();

      // Close inputs no longer available
      for (const [name, input] of this.inputs.entries()) {
        if (!availableInputs.includes(name)) {
          input.close();
          this.inputs.delete(name);
          console.log(`[MidiEngine] Closed disconnected input: ${name}`);
        }
      }

      // Open new inputs
      for (const name of availableInputs) {
        if (!this.inputs.has(name)) {
          try {
            const input = new easymidi.Input(name);
            this.setupInputListeners(name, input);
            this.inputs.set(name, input);
            console.log(`[MidiEngine] Opened MIDI input: ${name}`);
          } catch (err) {
            console.error(`[MidiEngine] Failed to open input ${name}:`, err);
          }
        }
      }
    } catch (err) {
      console.warn('[MidiEngine] MIDI refresh devices failed:', err);
    }
  }

  private setupInputListeners(portName: string, input: easymidi.Input): void {
    const handleMsg = (messageType: MidiMessageType, msg: any) => {
      const channel = (msg.channel || 0) + 1;
      const note = msg.note;
      const cc = msg.controller;
      const value = msg.value;

      if (this.isLearning && this.learningMappingId) {
        const targetMapping = this.mappings.find(m => m.id === this.learningMappingId);
        if (targetMapping) {
          targetMapping.inputName = portName;
          targetMapping.messageType = messageType;
          targetMapping.channel = channel;
          targetMapping.note = note;
          targetMapping.cc = cc;
          targetMapping.value = value;
          this.saveMappings();

          const learned = { ...targetMapping };
          this.isLearning = false;
          this.learningMappingId = undefined;

          if (this.onMidiLearned) {
            this.onMidiLearned(learned.id, learned);
          }
          return;
        }
      }

      // Check mapping matches
      for (const mapping of this.mappings) {
        if (mapping.inputName && mapping.inputName.trim() !== '' && mapping.inputName !== 'Any Device') {
          if (mapping.inputName !== portName) continue;
        }
        if (mapping.messageType !== messageType) continue;
        if (mapping.channel && mapping.channel !== channel) continue;

        if (messageType === 'note-on' || messageType === 'note-off') {
          if (mapping.note !== undefined && mapping.note !== note) continue;
        } else if (messageType === 'cc') {
          if (mapping.cc !== undefined && mapping.cc !== cc) continue;
        } else if (messageType === 'pc') {
          if (mapping.note !== undefined && mapping.note !== note) continue;
        }

        // Trigger action
        this.onActionTriggered(mapping.action);
      }
    };

    input.on('noteon', msg => {
      if (msg.velocity === 0) {
        handleMsg('note-off', msg);
      } else {
        handleMsg('note-on', msg);
      }
    });
    input.on('noteoff', msg => handleMsg('note-off', msg));
    input.on('cc', msg => handleMsg('cc', msg));
    input.on('program', msg => handleMsg('pc', msg));
  }

  public startLearn(mappingId: string): void {
    this.isLearning = true;
    this.learningMappingId = mappingId;
  }

  public cancelLearn(): void {
    this.isLearning = false;
    this.learningMappingId = undefined;
  }

  public addMapping(mapping: MidiMapping): void {
    this.mappings.push(mapping);
    this.saveMappings();
  }

  public updateMapping(updated: MidiMapping): void {
    const idx = this.mappings.findIndex(m => m.id === updated.id);
    if (idx !== -1) {
      this.mappings[idx] = updated;
    } else {
      this.mappings.push(updated);
    }
    this.saveMappings();
  }

  public removeMapping(mappingId: string): void {
    this.mappings = this.mappings.filter(m => m.id !== mappingId);
    this.saveMappings();
  }

  public getMappings(): MidiMapping[] {
    return [...this.mappings];
  }

  public async loadMappings(): Promise<void> {
    try {
      const data = await fs.readFile(MIDI_FILE, 'utf-8');
      this.mappings = JSON.parse(data);
    } catch (err) {
      this.mappings = [];
    }
  }

  public async saveMappings(): Promise<void> {
    try {
      await fs.writeFile(MIDI_FILE, JSON.stringify(this.mappings, null, 2), 'utf-8');
    } catch (err) {
      console.error('[MidiEngine] Failed to save MIDI mappings:', err);
    }
  }
}
