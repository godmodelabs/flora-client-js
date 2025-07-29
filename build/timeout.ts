const DEFAULT_TIMEOUT = 15000;

export default function timeout({ timeout }: { timeout?: string | number }) {
    if (!timeout) return DEFAULT_TIMEOUT;
    if (Number.isNaN(Number(timeout))) return DEFAULT_TIMEOUT;
    return parseInt(String(timeout), 10);
}
