import { spawn } from 'child_process';
import type { VerificationCommand, VerificationResult } from '../types.js';

export async function runVerificationCommand(
  command: VerificationCommand,
  directory: string,
  timeout: number
): Promise<VerificationResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const proc = spawn(command.command, {
      cwd: directory,
      shell: true,
      timeout: timeout * 1000,
    });

    let output = '';

    proc.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      output += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        command,
        success: code === 0,
        output: truncateOutput(output, 10000),
        exitCode: code ?? 1,
        duration: Date.now() - startTime,
      });
    });

    proc.on('error', (err) => {
      resolve({
        command,
        success: false,
        output: `Failed to run command: ${err.message}\n${output}`,
        exitCode: 1,
        duration: Date.now() - startTime,
      });
    });
  });
}

function truncateOutput(output: string, maxLength: number): string {
  if (output.length <= maxLength) return output;
  return '...[truncated]...\n' + output.slice(-maxLength);
}
