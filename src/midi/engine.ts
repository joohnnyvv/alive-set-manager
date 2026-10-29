import easymidi from 'easymidi';
import fs from 'fs/promises';
import path from 'path';
import { dataDirectory, atomicJson, readJson } from '../storage/files.js';
import { MidiMapping, MidiAction, MidiMessageType } from '../types/index.js';

function getStorageDir(): string {
  return dataDirectory();
}

function getDefaultMidiFilePath(): string {
  return path.join(getStorageDir(), 'midi-mappings.json');
}

export class MidiEngine {
  private inputs: Map<string, easymidi.Input> = new Map();
  private mappings: MidiMapping[] = [];
  private isLearning = false;
  private learningMappingId?: string;
  private storageFilePath: string;

  constructor(
    private onActionTriggered: (action: MidiAction) => void,
    private onMidiLearned?: (mappingId: string, mapping: MidiMapping) => void,
    customFilePath?: string
  ) {
    this.storageFilePath = customFilePath || getDefaultMidiFilePath();
  }

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

  public close(): void {
    for (const [name, input] of this.inputs.entries()) {
      try {
        input.close();
      } catch (err) {
        console.warn(`[MidiEngine] Error closing input ${name}:`, err);
      }
    }
    this.inputs.clear();
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
      const value = msg.value !== undefined ? msg.value : (msg.velocity !== undefined ? msg.velocity : msg.number);

      if (this.isLearning && this.learningMappingId) {
        const targetMapping = this.mappings.find(m => m.id === this.learningMappingId);
        if (targetMapping) {
          targetMapping.inputName = portName;
          targetMapping.messageType = messageType;
          targetMapping.channel = channel;
          targetMapping.note = note;
          targetMapping.cc = cc;
          // For notes, velocity is dynamic, so keep value undefined for "any velocity"; for CC/PC user can override
          targetMapping.value = undefined;
          this.saveMappings().catch(err => {
            console.error('[MidiEngine] Failed to save learned mapping:', err);
          });

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

        // Value-specific match check (when mapping.value is defined, require exact match)
        if (mapping.value !== undefined && mapping.value !== value) continue;

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

  public async addMapping(mapping: MidiMapping): Promise<void> {
    const existingIdx = this.mappings.findIndex(m => m.id === mapping.id);
    if (existingIdx !== -1) {
      this.mappings[existingIdx] = mapping;
    } else {
      this.mappings.push(mapping);
    }
    await this.saveMappings();
  }

  public async updateMapping(updated: MidiMapping): Promise<void> {
    const idx = this.mappings.findIndex(m => m.id === updated.id);
    if (idx !== -1) {
      this.mappings[idx] = updated;
    } else {
      this.mappings.push(updated);
    }
    await this.saveMappings();
  }

  public async removeMapping(mappingId: string): Promise<void> {
    this.mappings = this.mappings.filter(m => m.id !== mappingId);
    await this.saveMappings();
  }

  public async setMappings(mappings: MidiMapping[]): Promise<void> {
    this.mappings = [...mappings];
    await this.saveMappings();
  }

  public getMappings(): MidiMapping[] {
    return [...this.mappings];
  }

  public async loadMappings(): Promise<void> {
    const value = await readJson(this.storageFilePath);
    if (value === undefined) { this.mappings = []; return; }
    if (!Array.isArray(value) || !value.every(m => m && typeof m.id === 'string' && typeof m.action?.type === 'string')) {
      throw new Error('Invalid saved MIDI mappings. Original file retained.');
    }
    this.mappings = value;
  }

  public async saveMappings(): Promise<void> {
    await atomicJson(this.storageFilePath, this.mappings);
  }
}
