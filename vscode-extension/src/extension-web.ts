import * as vscode from 'vscode';
import { DevGlobeSidebarProvider } from './sidebar';
import { initLogger, log } from './logger';
import { mapLanguageId } from './shared';
import { WebCoreClient } from './web-core-client';
import {
    clearApiKey,
    getConfigUri,
    getLogUri,
    readApiKey,
    isDebugEnabled,
    setDebug,
    writeApiKey,
} from './web-config';

const SECRET_API_KEY = 'devglobe.apiKey';

async function getPluginVersion(context: vscode.ExtensionContext): Promise<string> {
    try {
        const pkgUri = vscode.Uri.joinPath(context.extensionUri, 'package.json');
        const bytes = await vscode.workspace.fs.readFile(pkgUri);
        const pkg = JSON.parse(new TextDecoder().decode(bytes));
        return pkg.version || '0.0.0';
    } catch {
        return '0.0.0';
    }
}

async function getAndMigrateApiKey(context: vscode.ExtensionContext): Promise<string> {
    const configKey = await readApiKey(context);
    if (configKey) {
        await context.secrets.store(SECRET_API_KEY, configKey);
        return configKey;
    }

    const stored = await context.secrets.get(SECRET_API_KEY);
    if (stored) {
        await writeApiKey(stored, context);
        return stored;
    }

    const config = vscode.workspace.getConfiguration('devglobe');
    const legacy = config.get<string>('apiKey', '');
    if (legacy) {
        await context.secrets.store(SECRET_API_KEY, legacy);
        try {
            await config.update('apiKey', undefined, vscode.ConfigurationTarget.Global);
        } catch {
        }
        await writeApiKey(legacy, context);
        log.info('API key migrated from settings.json to secure storage + globalStorage config.toml');
        return legacy;
    }
    return '';
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    initLogger(context.extensionMode === vscode.ExtensionMode.Development);
    log.info('DevGlobe activating…');
    log.info(`Web origin: ${globalThis.location?.origin ?? 'unknown-origin'}`);

    const pluginVersion = await getPluginVersion(context);
    const sidebar = new DevGlobeSidebarProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            DevGlobeSidebarProvider.viewType,
            sidebar,
            { webviewOptions: { retainContextWhenHidden: true } },
        ),
    );

    const onInvalidApiKey = async (): Promise<void> => {
        await context.secrets.delete(SECRET_API_KEY);
        await clearApiKey(context);
        log.info('API key cleared after server rejected it (401)');
    };

    const client = new WebCoreClient(
        context,
        (state) => sidebar.updateState(state),
        pluginVersion,
        () => { void onInvalidApiKey(); },
    );
    sidebar.setStateGetter(() => client.getState());

    sidebar.setMessageHandler(async (msg) => {
        const config = vscode.workspace.getConfiguration('devglobe');

        switch (msg.type as string) {
            case 'saveToken': {
                const token = String(msg.token ?? '').trim();
                if (!token) {
                    vscode.window.showErrorMessage('DevGlobe: API key is empty.');
                    break;
                }
                await context.secrets.store(SECRET_API_KEY, token);
                await writeApiKey(token, context);
                client.init();
                client.start();
                sidebar.updateState(client.getState());
                vscode.window.showInformationMessage('DevGlobe: Connected!');
                break;
            }

            case 'setStatus': {
                const message = String(msg.message ?? '');
                client.setStatus(message);
                break;
            }

            case 'stopTracking': {
                await config.update('trackingEnabled', false, vscode.ConfigurationTarget.Global);
                client.pause();
                vscode.window.showInformationMessage('DevGlobe: Tracking stopped.');
                break;
            }

            case 'startTracking': {
                const apiKey = await getAndMigrateApiKey(context);
                if (!apiKey) break;
                await config.update('trackingEnabled', true, vscode.ConfigurationTarget.Global);
                client.init();
                client.start();
                vscode.window.showInformationMessage('DevGlobe: Tracking started.');
                break;
            }

            case 'disconnect': {
                await context.secrets.delete(SECRET_API_KEY);
                await clearApiKey(context);
                client.reset();
                vscode.window.showInformationMessage('DevGlobe: Disconnected.');
                break;
            }

            case 'openExternal': {
                const url = String(msg.url ?? '');
                try {
                    const parsed = vscode.Uri.parse(url);
                    if (parsed.scheme === 'https' && parsed.authority.endsWith('devglobe.app')) {
                        vscode.env.openExternal(parsed);
                    }
                } catch {
                }
                break;
            }
        }
    });

    function reportActivity(doc: vscode.TextDocument): void {
        if (doc.isUntitled) return;
        const file = doc.uri.scheme === 'file' ? doc.uri.fsPath : doc.uri.path;
        client.activity(file, mapLanguageId(doc.languageId));
    }

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((e) => reportActivity(e.document)),
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) reportActivity(editor.document);
        }),
        vscode.workspace.onDidOpenTextDocument((doc) => reportActivity(doc)),
        vscode.workspace.onDidSaveTextDocument((doc) => reportActivity(doc)),
    );

    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        reportActivity(activeEditor.document);
    }

    context.subscriptions.push(
        vscode.commands.registerCommand('devglobe.setStatus', async () => {
            const apiKey = await getAndMigrateApiKey(context);
            if (!apiKey) return;

            const message = await vscode.window.showInputBox({
                prompt: 'Set your DevGlobe status message',
                placeHolder: 'What are you working on?',
                validateInput: (v) => (v.length > 100 ? 'Max 100 characters' : null),
            });

            if (message === undefined) return;
            client.setStatus(message);
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('devglobe.showCodingTime', () => {
            const state = client.getState();
            vscode.window.showInformationMessage(`DevGlobe: ${state.codingTime} today`);
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('devglobe.openGlobe', () => {
            vscode.env.openExternal(vscode.Uri.parse('https://devglobe.app/space'));
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('devglobe.toggleDebug', async () => {
            const current = await isDebugEnabled(context);
            const pick = await vscode.window.showQuickPick(['true', 'false'], {
                title: 'DevGlobe Debug',
                placeHolder: `current value: ${current}`,
            });
            if (pick === undefined) return;
            const enabled = pick === 'true';
            await setDebug(enabled, context);
            vscode.window.showInformationMessage(
                `DevGlobe: debug ${enabled ? 'enabled' : 'disabled'}. Restart tracking to apply.`,
            );
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('devglobe.openLogFile', async () => {
            try {
                const uri = await getLogUri(context);
                await vscode.workspace.fs.stat(uri);
                await vscode.window.showTextDocument(uri);
            } catch {
                vscode.window.showInformationMessage(
                    'DevGlobe: log file is empty. Enable debug first (DevGlobe: Debug → true).',
                );
            }
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('devglobe.openConfigFile', async () => {
            try {
                const uri = await getConfigUri(context);
                await vscode.workspace.fs.stat(uri);
                await vscode.window.showTextDocument(uri);
            } catch {
                vscode.window.showWarningMessage(
                    'DevGlobe: no config file yet. Run setup first.',
                );
            }
        }),
    );

    const savedConfig = vscode.workspace.getConfiguration('devglobe');
    const apiKey = await getAndMigrateApiKey(context);
    const trackingEnabled = savedConfig.get<boolean>('trackingEnabled', true);

    if (apiKey && trackingEnabled) {
        client.init();
        client.start();
    } else if (apiKey) {
        client.init();
        sidebar.updateState(client.getState());
    } else {
        sidebar.updateState(client.getState());
    }

    log.info('DevGlobe activated.');
}

export function deactivate(): void {
    // WebCoreClient.dispose() handles cleanup via context.subscriptions.
}