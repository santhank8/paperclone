/**
 * Informational/benign stderr lines emitted by the Gemini CLI that must
 * not be surfaced as error messages. These are printed on every run
 * regardless of success/failure and hide the real error when the CLI
 * exits non-zero.
 */
const BENIGN_STDERR_PATTERNS: readonly RegExp[] = [
    /^YOLO mode is enabled/i,
    /cloudcode-pa\.googleapis\.com/i,
];

function isBenignStderrLine(line: string): boolean {
    return BENIGN_STDERR_PATTERNS.some((pattern) => pattern.test(line));
}

export function firstNonEmptyLine(text: string): string {
    return (
        text
            .split(/\r?\n/)
            .map((line) => line.trim())
            .find((line) => line.length > 0 && !isBenignStderrLine(line)) ?? ""
    );
}
