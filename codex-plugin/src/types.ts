export type Input = {
  session_id: string;
  cwd: string;
  hook_event_name: 'SessionStart' | 'UserPromptSubmit' | 'Stop';
  model?: string;
  permission_mode?: string;
  transcript_path?: string;
  turn_id?: string;
  prompt?: string;
  last_assistant_message?: string;
  source?: string;
  stop_hook_active?: boolean;
};
