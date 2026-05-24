import * as vscode from 'vscode';

const CONFIG_FILE_NAME = 'config.toml';
const LOG_FILE_NAME = 'devglobe.log';

function requireContext(context?: vscode.ExtensionContext): vscode.ExtensionContext {
    if (!context) {
        throw new Error('Extension context is required.');
    }
    return context;
}

async function ensureStorageRoot(context?: vscode.ExtensionContext): Promise<vscode.Uri> {
    const ctx = requireContext(context);
    await vscode.workspace.fs.createDirectory(ctx.globalStorageUri);
    return ctx.globalStorageUri;
}

async function readText(uri: vscode.Uri): Promise<string> {
    try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        return new TextDecoder().decode(bytes);
    } catch {
        return '';
    }
}

async function writeText(uri: vscode.Uri, content: string, context?: vscode.ExtensionContext): Promise<void> {
    const normalized = content.endsWith('\n') ? content : `${content}\n`;
    await ensureStorageRoot(context);
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(normalized));
}

function patchKey(content: string, key: string, newLine: string): string {
    const lines = content.split('\n');
    let beforeSection = true;
    let replaced = false;
    const updated: string[] = [];

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line.startsWith('[')) beforeSection = false;
        if (beforeSection && line.startsWith(key)) {
            updated.push(newLine);
            replaced = true;
        } else {
            updated.push(rawLine);
        }
    }

    if (!replaced) {
        updated.unshift(newLine);
    }

    return updated.join('\n').replace(/\n{3,}/g, '\n\n');
}

function removeKey(content: string, key: string): string {
    const lines = content.split('\n');
    let beforeSection = true;
    const updated: string[] = [];

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line.startsWith('[')) beforeSection = false;
        if (beforeSection && line.startsWith(key)) continue;
        updated.push(rawLine);
    }

    return updated.join('\n').replace(/\n{3,}/g, '\n\n');
}

export async function getConfigUri(context?: vscode.ExtensionContext): Promise<vscode.Uri> {
    const root = await ensureStorageRoot(context);
    return vscode.Uri.joinPath(root, CONFIG_FILE_NAME);
}

export async function getLogUri(context?: vscode.ExtensionContext): Promise<vscode.Uri> {
    const root = await ensureStorageRoot(context);
    return vscode.Uri.joinPath(root, LOG_FILE_NAME);
}

export async function readApiKey(context?: vscode.ExtensionContext): Promise<string> {
    const uri = await getConfigUri(context);
    const content = await readText(uri);
    let beforeSection = true;

    for (const rawLine of content.split('\n')) {
        const line = rawLine.trim();
        if (line.startsWith('[')) beforeSection = false;
        if (!beforeSection) continue;

        const match = line.match(/^api_key\s*=\s*"([^"]*)"/);
        if (match) return match[1];
    }

    return '';
}

export async function isDebugEnabled(context?: vscode.ExtensionContext): Promise<boolean> {
    const uri = await getConfigUri(context);
    const content = await readText(uri);
    let beforeSection = true;

    for (const rawLine of content.split('\n')) {
        const line = rawLine.trim();
        if (line.startsWith('[')) beforeSection = false;
        if (!beforeSection) continue;
        const match = line.match(/^debug\s*=\s*(true|false)/);
        if (match) return match[1] === 'true';
    }

    return false;
}

export async function setDebug(enabled: boolean, context?: vscode.ExtensionContext): Promise<void> {
    const uri = await getConfigUri(context);
    const content = await readText(uri);
    const output = enabled
        ? patchKey(content, 'debug', 'debug = true')
        : removeKey(content, 'debug');
    await writeText(uri, output, context);
}

export async function writeApiKey(apiKey: string, context?: vscode.ExtensionContext): Promise<void> {
    const uri = await getConfigUri(context);
    const content = await readText(uri);
    const output = patchKey(content, 'api_key', `api_key = "${apiKey}"`);
    await writeText(uri, output, context);
}

export async function clearApiKey(context?: vscode.ExtensionContext): Promise<void> {
    const uri = await getConfigUri(context);
    const content = await readText(uri);
    const output = removeKey(content, 'api_key');
    await writeText(uri, output, context);
}