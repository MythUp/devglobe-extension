export type HookHandler = {
  type: string;
  command: string;
  timeout?: number;
};

export type HookEntry = {
  matcher: string;
  hooks: HookHandler[];
};

export type HooksFile = {
  hooks: Record<string, HookEntry[]>;
};
