export default function querystringify(obj: Record<string, string | number | boolean>): string {
    return Object.keys(obj)
    .map((key) => encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]))
    .join('&');
}
