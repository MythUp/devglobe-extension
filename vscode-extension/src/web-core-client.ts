import * as vscode from 'vscode';
import { DEFAULT_STATE, detectEditor, type TrackerState } from './shared';
import { log } from './logger';
import { readApiKey, writeApiKey } from './web-config';

const API_BASE_URL = 'https://devglobe.app';
const KEEPALIVE_INTERVAL_MS = 30_000;
const ACTIVITY_TIMEOUT_MS = 60_000;
const OFFLINE_THRESHOLD = 2;
const SECRET_API_KEY = 'devglobe.apiKey';

class InvalidApiKeyError extends Error {
    readonly code = 'INVALID_API_KEY' as const;

    constructor() {
        super('Invalid API key');
        this.name = 'InvalidApiKeyError';
    }
}

interface HeartbeatEvent {
    time: number;
    file?: string;
    language?: string;
    repo?: string;
    branch?: string;
}

interface HeartbeatBatch {
    plugin_version: string;
    editor: string;
    platform: string;
    heartbeats: HeartbeatEvent[];
}

interface HeartbeatResponse {
    today_seconds?: number;
}

interface RepoFields {
    file?: string;
    repo?: string;
    branch?: string;
}

async function sendBatch(apiKey: string, batch: HeartbeatBatch): Promise<HeartbeatResponse> {
    log.info('web heartbeat send', {
        events: batch.heartbeats.length,
        editor: batch.editor,
        platform: batch.platform,
        keyLength: apiKey.length,
        origin: webOrigin(),
    });
    const res = await fetch(`${API_BASE_URL}/api/v2/heartbeat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(batch),
    });

    if (res.status === 401) {
        const body = await res.text().catch(() => '');
        log.error('web heartbeat rejected', { status: res.status, body: body.trim() || '<empty body>' });
        throw new InvalidApiKeyError();
    }
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        log.error('web heartbeat HTTP error', { status: res.status, body: body.trim() || '<empty body>' });
        throw new Error(`HTTP ${res.status}`);
    }
    return await res.json() as HeartbeatResponse;
}

async function sendStatus(apiKey: string, message: string): Promise<void> {
    log.info('web status send', {
        length: message.length,
        keyLength: apiKey.length,
        origin: webOrigin(),
    });
    const res = await fetch(`${API_BASE_URL}/api/v2/status`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ message: message.slice(0, 100) }),
    });

    if (res.status === 401) {
        const body = await res.text().catch(() => '');
        log.error('web status rejected', { status: res.status, body: body.trim() || '<empty body>' });
        throw new InvalidApiKeyError();
    }
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        log.error('web status HTTP error', { status: res.status, body: body.trim() || '<empty body>' });
        throw new Error(`HTTP ${res.status}`);
    }
}

function describeRequestFailure(err: unknown): string {
    if (err instanceof TypeError && err.message === 'Failed to fetch') {
        return `browser blocked the request from origin ${webOrigin()} (likely CORS/preflight) or the network is unavailable`;
    }
    if (err instanceof Error) {
        return err.message;
    }
    return String(err);
}

function webOrigin(): string {
    try {
        return globalThis.location?.origin ?? 'unknown-origin';
    } catch {
        return 'unknown-origin';
    }
}

function webPlatform(): string {
    try {
        const nav = globalThis.navigator;
        const hint = [nav?.userAgentData?.platform, nav?.platform, nav?.userAgent]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        // Treat mobile UA hints as desktop equivalents for our reporting:
        // - Android -> report as Linux
        // - iPhone / iPad / iOS -> report as macOS
        if (hint.includes('android')) return 'Linux';
        if (hint.includes('iphone') || hint.includes('ipad') || hint.includes('ios')) return 'macOS';
        if (hint.includes('windows')) return 'Windows';
        if (hint.includes('mac')) return 'macOS';
        return 'Linux';
    } catch {
        return 'Linux';
    }
}

type StateChangeHandler = (state: TrackerState) => void;

export class WebCoreClient implements vscode.Disposable {
    private state: TrackerState = { ...DEFAULT_STATE };
    private statusBarItem: vscode.StatusBarItem | null = null;
    private timer: ReturnType<typeof setInterval> | null = null;
    private pending: HeartbeatEvent[] = [];
    private lastActivity = 0;
    private lastFileInput: string | undefined;
    private currentFile: string | undefined;
    private currentLanguage: string | undefined;
    private currentRepo: string | undefined;
    private currentBranch: string | undefined;
    // Memoized API key resolution. Avoids a config.toml FS read + secrets
    // round-trip on every activity event. Invalidated on reset() and when
    // all candidates get rejected (401), so the next call re-fetches fresh
    // values in case the user updated the key.
    private cachedCandidates: Array<{ source: string; key: string }> | null = null;
    private lastDedup: { file: string | undefined; language: string | undefined; at: number } = {
        file: undefined,
        language: undefined,
        at: 0,
    };
    private offline = false;
    private consecutiveErrors = 0;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly onStateChange: StateChangeHandler,
        private readonly pluginVersion: string,
        private readonly onInvalidApiKey: () => void = () => {},
    ) {
        context.subscriptions.push(this);
    }

    dispose(): void {
        this.stopTimer();
        this.statusBarItem?.dispose();
    }

    getState(): TrackerState {
        return { ...this.state };
    }

    init(): void {
        this.state.configured = true;
        this.onStateChange(this.state);
        this.startTimer();
    }

    start(): void {
        this.ensureStatusBar();
        this.state.tracking = true;
        this.onStateChange(this.state);
        this.startTimer();
    }

    pause(): void {
        this.state.tracking = false;
        this.stopTimer();
        this.statusBarItem?.hide();
        this.onStateChange(this.state);
    }

    reset(): void {
        this.stopTimer();
        this.state = { ...DEFAULT_STATE };
        this.pending = [];
        this.lastActivity = 0;
        this.currentFile = undefined;
        this.currentLanguage = undefined;
        this.currentRepo = undefined;
        this.currentBranch = undefined;
        this.lastFileInput = undefined;
        this.lastDedup = { file: undefined, language: undefined, at: 0 };
        this.offline = false;
        this.consecutiveErrors = 0;
        this.cachedCandidates = null;
        this.statusBarItem?.hide();
        this.onStateChange(this.state);
    }

    activity(resource: vscode.Uri, language?: string): void {
        void this.handleActivity(resource, language);
    }

    setStatus(message: string): void {
        void this.handleStatus(message);
    }

    private async resolveApiKeyCandidates(scope: string): Promise<Array<{ source: string; key: string }>> {
        if (this.cachedCandidates) {
            return this.cachedCandidates;
        }

        const candidates: Array<{ source: string; key: string }> = [];
        const configKey = await readApiKey(this.context);
        if (configKey) {
            await this.context.secrets.store(SECRET_API_KEY, configKey);
            candidates.push({ source: 'config.toml', key: configKey });
            log.info('web api key resolved from config.toml', { scope, length: configKey.length });
        }

        const secretKey = await this.context.secrets.get(SECRET_API_KEY);
        if (secretKey) {
            const duplicate = candidates.some((candidate) => candidate.key === secretKey);
            log.info('web api key resolved from secrets', { scope, length: secretKey.length });
            if (!duplicate) {
                candidates.push({ source: 'secrets', key: secretKey });
            }
        }

        if (candidates.length === 0) {
            log.info('web api key resolved: none', { scope });
        }

        this.cachedCandidates = candidates;
        return candidates;
    }

    private async tryStatusWithCandidates(message: string): Promise<void> {
        const candidates = await this.resolveApiKeyCandidates('status');
        for (const candidate of candidates) {
            try {
                log.info('web status attempt', {
                    source: candidate.source,
                    length: message.length,
                    keyLength: candidate.key.length,
                    origin: webOrigin(),
                });
                await sendStatus(candidate.key, message);
                if (candidate.source === 'secrets') {
                    await writeApiKey(candidate.key, this.context);
                }
                return;
            } catch (err) {
                if (!(err instanceof InvalidApiKeyError)) {
                    throw err;
                }
                log.warn('web status candidate rejected', { source: candidate.source });
            }
        }

        // All cached candidates rejected (401). Drop the cache so the next
        // call re-reads fresh values in case the user rotated their key.
        this.cachedCandidates = null;
        throw new InvalidApiKeyError();
    }

    private async tryHeartbeatWithCandidates(batch: HeartbeatBatch): Promise<HeartbeatResponse> {
        const candidates = await this.resolveApiKeyCandidates('heartbeat');
        let lastInvalid = false;
        for (const candidate of candidates) {
            try {
                log.info('web heartbeat attempt', {
                    source: candidate.source,
                    events: batch.heartbeats.length,
                    keyLength: candidate.key.length,
                    origin: webOrigin(),
                });
                const resp = await sendBatch(candidate.key, batch);
                if (candidate.source === 'secrets') {
                    await writeApiKey(candidate.key, this.context);
                }
                return resp;
            } catch (err) {
                if (err instanceof InvalidApiKeyError) {
                    lastInvalid = true;
                    log.warn('web heartbeat candidate rejected', { source: candidate.source });
                    continue;
                }
                throw err;
            }
        }

        if (lastInvalid) {
            // All cached candidates rejected (401). Drop the cache so the
            // next call re-reads fresh values in case the user rotated.
            this.cachedCandidates = null;
            throw new InvalidApiKeyError();
        }

        throw new Error('No API key available');
    }

    private async handleActivity(resource: vscode.Uri, language?: string): Promise<void> {
        if (!this.state.tracking) return;
        const candidates = await this.resolveApiKeyCandidates('activity');
        const apiKey = candidates[0]?.key;
        if (!apiKey) {
            log.info('web activity skipped: no api key available', {
                filePath: resource.fsPath || resource.path,
                language,
            });
            return;
        }

        log.info('web activity received', {
            filePath: resource.fsPath || resource.path,
            language,
            keyLength: apiKey.length,
            origin: webOrigin(),
        });

        const repoFields = await this.resolveRepoFields(resource);
        const filePath = repoFields.file ?? resource.fsPath ?? resource.path;
        const nextRepo = repoFields.repo;
        const nextBranch = repoFields.branch;

        const now = Date.now();
        this.lastActivity = now;

        const fileChanged = filePath !== this.lastFileInput;
        const langChanged = language !== undefined && language !== this.currentLanguage;
        const repoChanged = nextRepo !== this.currentRepo;
        const branchChanged = nextBranch !== this.currentBranch;
        if (!fileChanged && !langChanged && !repoChanged && !branchChanged) {
            const dup = this.lastDedup;
            if (dup.file === filePath && dup.language === language && now - dup.at < 2_000) {
                return;
            }
        }

        const firstActivity = this.lastFileInput === undefined;
        const transition = (fileChanged || langChanged || repoChanged || branchChanged) && !firstActivity;

        this.lastFileInput = filePath;
        this.currentFile = filePath;
        this.currentRepo = nextRepo;
        this.currentBranch = nextBranch;
        if (language !== undefined) {
            this.currentLanguage = language || undefined;
            const nextLanguage = this.currentLanguage ?? null;
            if (this.state.language !== nextLanguage) {
                this.state.language = nextLanguage;
                this.onStateChange(this.state);
            }
        }

        if (firstActivity || transition) {
            this.pending.push(this.buildEvent(now));
        }

        this.lastDedup = { file: filePath, language, at: now };
    }

    private async handleStatus(message: string): Promise<void> {
        const candidates = await this.resolveApiKeyCandidates('status');
        if (candidates.length === 0) {
            log.error('web status requested without api key');
            vscode.window.showErrorMessage('DevGlobe: not configured');
            return;
        }

        try {
            log.info('web status requested', {
                length: message.length,
                origin: webOrigin(),
                candidates: candidates.map((candidate) => ({
                    source: candidate.source,
                    length: candidate.key.length,
                })),
            });
            await this.tryStatusWithCandidates(message);
            vscode.window.showInformationMessage('DevGlobe: Status updated');
        } catch (err) {
            if (err instanceof InvalidApiKeyError) {
                // Keep the current session alive on a status-only 401.
                // A single failed status request should not wipe the API key
                // and force the user into a reconnect loop.
                vscode.window.showErrorMessage(
                    `DevGlobe: status rejected by server (401). Key kept; retry or reconnect if needed.`,
                );
                return;
            }
            vscode.window.showErrorMessage(`DevGlobe: ${describeRequestFailure(err)}`);
        }
    }

    private startTimer(): void {
        if (this.timer) return;
        this.timer = setInterval(() => {
            void this.tick();
        }, KEEPALIVE_INTERVAL_MS);
    }

    private stopTimer(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    private async tick(): Promise<void> {
        if (!this.state.tracking) return;
        const candidates = await this.resolveApiKeyCandidates('heartbeat');
        if (candidates.length === 0) return;

        const now = Date.now();
        if (now - this.lastActivity > ACTIVITY_TIMEOUT_MS && this.pending.length === 0) {
            return;
        }

        if (this.currentFile !== undefined) {
            this.pending.push(this.buildEvent(now));
        }
        if (this.pending.length === 0) return;

        const batch: HeartbeatBatch = {
            plugin_version: this.pluginVersion,
            editor: detectEditor(),
            platform: webPlatform(),
            heartbeats: this.pending,
        };

        try {
            const resp = await this.tryHeartbeatWithCandidates(batch);
            this.pending = [];
            this.consecutiveErrors = 0;

            if (this.offline) {
                this.offline = false;
                this.onStateChange(this.state);
            }

            if (resp.today_seconds !== undefined) {
                this.state.todaySeconds = resp.today_seconds;
                this.state.codingTime = this.formatSeconds(resp.today_seconds);
                this.state.language = this.currentLanguage ?? null;
                this.onStateChange(this.state);
                this.updateStatusBarTime(resp.today_seconds);
            }
        } catch (err) {
            if (err instanceof InvalidApiKeyError) {
                this.pending = [];
                this.state.configured = false;
                this.state.tracking = false;
                this.statusBarItem?.hide();
                this.onStateChange(this.state);
                this.onInvalidApiKey();
                return;
            }

            this.consecutiveErrors += 1;
            log.warn('web heartbeat tick failed', {
                consecutiveErrors: this.consecutiveErrors,
                tracking: this.state.tracking,
                offline: this.offline,
                currentFile: this.currentFile,
                currentLanguage: this.currentLanguage,
            });
            if (this.consecutiveErrors >= OFFLINE_THRESHOLD && !this.offline) {
                this.offline = true;
                this.onStateChange(this.state);
            }
        }
    }

    private buildEvent(now: number): HeartbeatEvent {
        const event: HeartbeatEvent = { time: now / 1_000 };
        if (this.currentFile !== undefined) event.file = this.currentFile;
        if (this.currentLanguage !== undefined) event.language = this.currentLanguage;
        if (this.currentRepo !== undefined) event.repo = this.currentRepo;
        if (this.currentBranch !== undefined) event.branch = this.currentBranch;
        return event;
    }

    private async resolveRepoFields(resource: vscode.Uri): Promise<RepoFields> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(resource) ?? vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return {};

        const apiFields = await this.resolveRepoFieldsFromGitExtension(resource, workspaceFolder.uri);
        if (apiFields.repo || apiFields.branch || apiFields.file) {
            return apiFields;
        }

        const gitMarker = vscode.Uri.joinPath(workspaceFolder.uri, '.git');
        const markerType = await this.statKind(gitMarker);
        if (markerType === undefined) return {};

        let gitDir = gitMarker;
        if (markerType === 'file') {
            const content = await this.readText(gitMarker);
            const match = content.match(/^gitdir:\s*(.+)$/m);
            if (!match) return {};
            gitDir = this.resolveGitDir(workspaceFolder.uri, match[1].trim());
        }

        const [branch, repo] = await Promise.all([
            this.readBranch(gitDir),
            this.readRepo(gitDir),
        ]);

        const fields: RepoFields = {};
        if (repo) fields.repo = repo;
        if (branch) fields.branch = branch;
        if (repo || branch) {
            const root = workspaceFolder.uri.path;
            const current = resource.path;
            if (current.toLowerCase().startsWith(root.toLowerCase())) {
                fields.file = current.slice(root.length).replace(/^\//, '');
            } else {
                fields.file = resource.fsPath || resource.path;
            }
        }
        return fields;
    }

    private async resolveRepoFieldsFromGitExtension(resource: vscode.Uri, workspaceRoot: vscode.Uri): Promise<RepoFields> {
        try {
            const gitExtension = vscode.extensions.getExtension<any>('vscode.git');
            const exported = gitExtension ? (gitExtension.isActive ? gitExtension.exports : await gitExtension.activate()) : undefined;
            const api = exported?.getAPI?.(1);
            const repositories = api?.repositories ?? [];
            const repo = repositories.find((candidate: any) => this.isResourceUnderRoot(resource, candidate?.rootUri));
            if (!repo) return {};

            const repoFields: RepoFields = {};
            const rootUri = repo.rootUri ?? workspaceRoot;
            const headName = repo.state?.HEAD?.name ?? undefined;
            if (headName) repoFields.branch = headName;

            const remoteUrl = this.pickOriginRemoteUrl(repo);
            if (remoteUrl) repoFields.repo = this.canonicalizeRepoUrl(remoteUrl) ?? undefined;

            const relative = this.relativePathFromRoot(resource, rootUri);
            if (relative) repoFields.file = relative;

            if (repoFields.repo || repoFields.branch || repoFields.file) {
                log.info('web repo resolved from git extension', {
                    filePath: resource.fsPath || resource.path,
                    repo: repoFields.repo,
                    branch: repoFields.branch,
                });
            }

            return repoFields;
        } catch (err) {
            log.warn('web git extension repo lookup failed', err instanceof Error ? err.message : String(err));
            return {};
        }
    }

    private isResourceUnderRoot(resource: vscode.Uri, rootUri: vscode.Uri | undefined): boolean {
        if (!rootUri) return false;
        const resourcePath = (resource.fsPath || resource.path).toLowerCase();
        const rootPath = (rootUri.fsPath || rootUri.path).toLowerCase();
        return resourcePath.startsWith(rootPath);
    }

    private relativePathFromRoot(resource: vscode.Uri, rootUri: vscode.Uri): string | undefined {
        const resourcePath = resource.fsPath || resource.path;
        const rootPath = rootUri.fsPath || rootUri.path;
        if (!resourcePath.toLowerCase().startsWith(rootPath.toLowerCase())) {
            return undefined;
        }
        const rel = resourcePath.slice(rootPath.length).replace(/^[/\\]/, '');
        return rel || undefined;
    }

    private pickOriginRemoteUrl(repo: any): string | undefined {
        const remotes = repo?.state?.remotes ?? [];
        const origin = remotes.find((remote: any) => remote?.name === 'origin') ?? remotes[0];
        if (!origin) return undefined;
        return origin.fetchUrl ?? origin.pushUrl ?? origin.url ?? undefined;
    }

    private resolveGitDir(base: vscode.Uri, target: string): vscode.Uri {
        if (/^[a-zA-Z]:[\\/]/.test(target) || target.startsWith('/')) {
            return vscode.Uri.file(target);
        }
        return vscode.Uri.joinPath(base, target.replace(/\\/g, '/'));
    }

    private async statKind(uri: vscode.Uri): Promise<'file' | 'directory' | undefined> {
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            if (stat.type === vscode.FileType.File) return 'file';
            if (stat.type === vscode.FileType.Directory) return 'directory';
        } catch {
        }
        return undefined;
    }

    private async readText(uri: vscode.Uri): Promise<string> {
        try {
            const bytes = await vscode.workspace.fs.readFile(uri);
            return new TextDecoder().decode(bytes).trim();
        } catch {
            return '';
        }
    }

    private async readBranch(gitDir: vscode.Uri): Promise<string | undefined> {
        const head = await this.readText(vscode.Uri.joinPath(gitDir, 'HEAD'));
        const match = head.match(/^ref:\s*refs\/heads\/(.+)$/);
        return match?.[1];
    }

    private async readRepo(gitDir: vscode.Uri): Promise<string | undefined> {
        const config = await this.readText(vscode.Uri.joinPath(gitDir, 'config'));
        const lines = config.split('\n');
        let inOrigin = false;
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('[')) {
                inOrigin = /^\[remote\s+"origin"\]$/.test(trimmed);
                continue;
            }
            if (!inOrigin) continue;
            const match = trimmed.match(/^url\s*=\s*(.+)$/);
            if (match) {
                return this.canonicalizeRepoUrl(match[1].trim()) ?? undefined;
            }
        }
        return undefined;
    }

    private canonicalizeRepoUrl(raw: string): string | null {
        if (!raw) return null;
        const stripped = raw.replace(/\.git$/, '');
        const ssh = stripped.match(/^[\w.-]+@([^:]+):(.+)$/);
        if (ssh) return `https://${ssh[1]}/${ssh[2]}`;
        const sshUrl = stripped.match(/^ssh:\/\/[^@]+@([^/:]+)(?::\d+)?\/(.+)$/);
        if (sshUrl) return `https://${sshUrl[1]}/${sshUrl[2]}`;
        if (/^https?:\/\//.test(stripped)) return stripped;
        const gitProto = stripped.match(/^git:\/\/([^/]+)\/(.+)$/);
        if (gitProto) return `https://${gitProto[1]}/${gitProto[2]}`;
        return null;
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
        const label = this.formatSeconds(todaySeconds);
        this.statusBarItem.text = `$(clock) ${label}`;
        this.statusBarItem.tooltip = `DevGlobe: ${label} coded today`;
        this.statusBarItem.show();
    }

    private formatSeconds(todaySeconds: number): string {
        const h = Math.floor(todaySeconds / 3_600);
        const m = Math.floor((todaySeconds % 3_600) / 60);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
}