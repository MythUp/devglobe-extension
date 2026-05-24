import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import { createInterface, Interface } from 'readline';
import * as path from 'path';
import { log } from './logger';
import { DEFAULT_STATE, detectEditor, mapLanguageId, type TrackerState } from './shared';

type CoreEvent =
    | { event: 'ready'; data: { configured: boolean } }
    | { event: 'not_configured' }
    | { event: 'invalid_api_key' }
    | { event: 'heartbeat_ok'; data: { today_seconds: number; language: string | null } }
    | { event: 'offline' }
    | { event: 'online' }
    | { event: 'status_ok' }
    | { event: 'status_error'; data: { message: string } };

export class CoreClient implements vscode.Disposable {
    private proc: ChildProcess | null = null;
    private rl: Interface | null = null;
    private state: TrackerState = { ...DEFAULT_STATE };
    private statusBarItem: vscode.StatusBarItem | null = null;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly onStateChange: (state: TrackerState) => void,
        private readonly pluginVersion: string,
        private readonly onInvalidApiKey: () => void = () => {},
    ) {
        context.subscriptions.push(this);
    }

    dispose(): void {
        this.tearDownProcess();
        this.statusBarItem?.dispose();
    }

    private tearDownProcess(): void {
        this.send({ method: 'shutdown' });
        this.proc?.kill();
        this.proc = null;
        this.rl?.close();
        this.rl = null;
    }

    getState(): TrackerState {
        return { ...this.state };
    }

    private ensureProcess(): void {
        if (this.proc && this.proc.exitCode === null) return;

        const corePath = path.join(this.context.extensionPath, 'out', 'devglobe-core.js');
        let proc: ChildProcess;
        try {
            proc = spawn(process.execPath, [corePath, 'daemon'], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });
        } catch (err) {
            this.handleProcessFailure(`Failed to start devglobe-core: ${(err as Error).message}`);
            return;
        }
        this.proc = proc;

        proc.on('error', (err) => {
            this.handleProcessFailure(`devglobe-core failed: ${err.message}`);
        });

        proc.stderr?.on('data', (chunk: Buffer) => {
            log.warn('core stderr:', chunk.toString().trim());
        });

        proc.on('exit', (code) => {
            log.info(`core exited with code ${code}`);
            const wasTracking = this.state.tracking;
            this.rl?.close();
            this.rl = null;
            this.proc = null;
            if (wasTracking) {
                this.state.tracking = false;
                this.onStateChange(this.state);
                vscode.window.showWarningMessage(
                    'DevGlobe: tracking stopped — devglobe-core exited unexpectedly.',
                );
            }
        });

        this.rl = createInterface({ input: proc.stdout!, terminal: false });
        this.rl.on('line', (line) => this.handleLine(line));
    }

    private handleProcessFailure(message: string): void {
        log.error(message);
        this.proc = null;
        this.rl?.close();
        this.rl = null;
        if (this.state.tracking) {
            this.state.tracking = false;
            this.onStateChange(this.state);
        }
        vscode.window.showErrorMessage(`DevGlobe: ${message}`);
    }

    private handleLine(line: string): void {
        let event: CoreEvent;
        try { event = JSON.parse(line); } catch { return; }

        switch (event.event) {
            case 'ready':
                this.state.configured = event.data.configured;
                this.onStateChange(this.state);
                break;

            case 'not_configured':
                this.state.configured = false;
                this.state.tracking = false;
                this.onStateChange(this.state);
                break;

            case 'invalid_api_key':
                this.state.configured = false;
                this.state.tracking = false;
                this.onStateChange(this.state);
                vscode.window.showErrorMessage(
                    'DevGlobe: invalid API key. Please reconnect with a valid key.',
                    'Get API key',
                ).then((choice) => {
                    if (choice === 'Get API key') {
                        vscode.env.openExternal(vscode.Uri.parse('https://devglobe.app/dashboard/settings'));
                    }
                });
                this.onInvalidApiKey();
                break;

            case 'heartbeat_ok':
                this.state.todaySeconds = event.data.today_seconds;
                this.state.language = event.data.language;
                this.state.tracking = true;
                this.state.offline = false;
                this.updateStatusBarTime(event.data.today_seconds);
                this.onStateChange(this.state);
                break;

            case 'offline':
                this.state.offline = true;
                this.onStateChange(this.state);
                break;

            case 'online':
                this.state.offline = false;
                this.onStateChange(this.state);
                break;

            case 'status_ok':
                log.info('core status ok');
                vscode.window.showInformationMessage('DevGlobe: Status updated');
                break;

            case 'status_error':
                log.warn('core status error', event.data.message);
                vscode.window.showErrorMessage(`DevGlobe: ${event.data.message}`);
                break;
        }
    }

    private send(msg: Record<string, unknown>): void {
        if (!this.proc?.stdin?.writable) return;
        this.proc.stdin.write(JSON.stringify(msg) + '\n');
    }

    init(): void {
        this.ensureProcess();
        this.send({
            method: 'init',
            params: {
                plugin_version: this.pluginVersion,
                editor: detectEditor(),
            },
        });
    }

    start(): void {
        this.ensureStatusBar();
        this.state.tracking = true;
        this.send({ method: 'resume' });
        this.onStateChange(this.state);
    }

    pause(): void {
        this.state.tracking = false;
        this.send({ method: 'pause' });
        this.statusBarItem?.hide();
        this.onStateChange(this.state);
    }

    activity(resource: vscode.Uri, language?: string): void {
        this.send({
            method: 'activity',
            params: { file: resource.fsPath, ...(language && { language }) },
        });
    }

    setStatus(message: string): void {
        log.info('core setStatus requested', { length: message.length });
        this.send({ method: 'set_status', params: { message } });
    }

    reset(): void {
        this.tearDownProcess();
        this.state = { ...DEFAULT_STATE };
        this.statusBarItem?.hide();
        this.onStateChange(this.state);
    }

    private ensureStatusBar(): void {
        if (this.statusBarItem) return;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.tooltip = 'DevGlobe: Coding time today';
        this.statusBarItem.text = '$(clock) 0m';
        this.statusBarItem.command = 'devglobe.openGlobe';
        this.statusBarItem.show();
        this.context.subscriptions.push(this.statusBarItem);
    }

    private updateStatusBarTime(todaySeconds: number): void {
        if (!this.statusBarItem) return;
        const h = Math.floor(todaySeconds / 3600);
        const m = Math.floor((todaySeconds % 3600) / 60);
        const label = h > 0 ? `${h}h ${m}m` : `${m}m`;
        this.state.codingTime = label;
        this.statusBarItem.text = `$(clock) ${label}`;
        this.statusBarItem.tooltip = `DevGlobe: ${label} coded today`;
        this.statusBarItem.show();
    }
}
